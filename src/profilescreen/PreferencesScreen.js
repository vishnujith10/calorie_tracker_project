import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { invalidateMainDashboardCache } from "../utils/cacheManager";

export const globalPreferencesCache = {
  weightUnit: null,
  heightUnit: null,
};

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

  const initialWeightUnit = globalPreferencesCache.weightUnit || "kg";
  const initialHeightUnit = globalPreferencesCache.heightUnit || "cm";

  const [weightUnit, setWeightUnit] = useState(initialWeightUnit);
  const [heightUnit, setHeightUnit] = useState(initialHeightUnit);

  const isConvertingWeightRef = useRef(false);
  const isConvertingHeightRef = useRef(false);

  const [breakfastReminder, setBreakfastReminder] = useState(true);
  const [lunchReminder, setLunchReminder] = useState(true);
  const [dinnerReminder, setDinnerReminder] = useState(true);

  const [workoutReminder, setWorkoutReminder] = useState(true);
  const [sleepReminder, setSleepReminder] = useState(false);

  const weightSlideAnim = useRef(
    new Animated.Value(initialWeightUnit === "lbs" ? 1 : 0)
  ).current;
  const heightSlideAnim = useRef(
    new Animated.Value(initialHeightUnit === "ft" ? 1 : 0)
  ).current;
  const themeSlideAnim = useRef(new Animated.Value(0)).current;

  const [weightButtonWidth, setWeightButtonWidth] = useState(0);
  const [heightButtonWidth, setHeightButtonWidth] = useState(0);
  const [themeButtonWidth, setThemeButtonWidth] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadLocalCache = async () => {
      try {
        const [cachedWeightUnit, cachedHeightUnit] = await Promise.all([
          AsyncStorage.getItem("@calora_pref_weight_unit"),
          AsyncStorage.getItem("@calora_pref_height_unit"),
        ]);
        if (!isMounted) return;
        if (cachedWeightUnit && cachedWeightUnit !== weightUnit) {
          globalPreferencesCache.weightUnit = cachedWeightUnit;
          setWeightUnit(cachedWeightUnit);
          weightSlideAnim.setValue(cachedWeightUnit === "lbs" ? 1 : 0);
        }
        if (cachedHeightUnit && cachedHeightUnit !== heightUnit) {
          globalPreferencesCache.heightUnit = cachedHeightUnit;
          setHeightUnit(cachedHeightUnit);
          heightSlideAnim.setValue(cachedHeightUnit === "ft" ? 1 : 0);
        }
      } catch (e) {
        // ignore
      }
    };

    loadLocalCache();
    fetchUserPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  const convertWeight = (value, fromUnit, toUnit) => {
    if (!value || fromUnit === toUnit) return value;
    const num = Number(value);
    if (isNaN(num) || num <= 0) return value;

    if (fromUnit === "kg" && toUnit === "lbs") {
      // 1 kg = 2.20462262 lbs
      // 59 kg * 2.20462262 = 130.0727... -> 130.1 lbs
      return parseFloat((num * 2.20462262).toFixed(1));
    }
    if (fromUnit === "lbs" && toUnit === "kg") {
      // 130.1 lbs / 2.20462262 = 59.012... -> 59.0 kg
      return parseFloat((num / 2.20462262).toFixed(1));
    }
    return value;
  };

  const convertHeight = (value, fromUnit, toUnit) => {
    if (!value || fromUnit === toUnit) return value;
    const num = Number(value);
    if (isNaN(num) || num <= 0) return value;

    if (fromUnit === "cm" && toUnit === "ft") {
      // 1 ft = 30.48 cm
      // 168 cm / 30.48 = 5.511811... ft -> 5.51 ft
      return parseFloat((num / 30.48).toFixed(2));
    }
    if (fromUnit === "ft" && toUnit === "cm") {
      // 5.51 ft * 30.48 = 167.9448 cm -> clean round to 168 cm
      const cmVal = num * 30.48;
      const rounded = Math.round(cmVal);
      if (Math.abs(cmVal - rounded) < 0.15) {
        return rounded;
      }
      return parseFloat(cmVal.toFixed(1));
    }
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
        const dbWeightUnit = data.weight_unit || "kg";
        const dbHeightUnit = data.height_unit || "cm";

        globalPreferencesCache.weightUnit = dbWeightUnit;
        globalPreferencesCache.heightUnit = dbHeightUnit;

        setWeightUnit(dbWeightUnit);
        setHeightUnit(dbHeightUnit);

        AsyncStorage.setItem("@calora_pref_weight_unit", dbWeightUnit).catch(() => {});
        AsyncStorage.setItem("@calora_pref_height_unit", dbHeightUnit).catch(() => {});
      }
    } catch (error) {
      console.error("Error fetching user preferences:", error);
    }
  };

  const handleWeightUnitChange = async (targetUnit) => {
    if (targetUnit === weightUnit) return;
    if (isConvertingWeightRef.current) return;
    isConvertingWeightRef.current = true;

    const oldUnit = weightUnit;
    console.log(`Weight unit changing from ${oldUnit} to ${targetUnit}`);

    // Update UI & Cache immediately
    setWeightUnit(targetUnit);
    globalPreferencesCache.weightUnit = targetUnit;
    AsyncStorage.setItem("@calora_pref_weight_unit", targetUnit).catch(() => {});

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        isConvertingWeightRef.current = false;
        return;
      }

      // Check current profile from database
      const { data: profile, error } = await supabase
        .from("user_profile")
        .select("weight, target_weight, weight_unit")
        .eq("id", user.id)
        .single();

      if (error || !profile) {
        console.error("Error fetching profile for weight conversion:", error);
        isConvertingWeightRef.current = false;
        return;
      }

      const dbUnit = profile.weight_unit || oldUnit || "kg";

      // If DB is already in targetUnit, avoid re-converting numbers
      if (dbUnit === targetUnit) {
        console.log(`DB weight_unit is already ${targetUnit}, skipping conversion`);
        isConvertingWeightRef.current = false;
        return;
      }

      const updates = { weight_unit: targetUnit };
      if (profile.weight != null) {
        updates.weight = convertWeight(Number(profile.weight), dbUnit, targetUnit);
      }
      if (profile.target_weight != null) {
        updates.target_weight = convertWeight(
          Number(profile.target_weight),
          dbUnit,
          targetUnit
        );
      }

      // Atomically update user_profile in one single call
      const { error: updateError } = await supabase
        .from("user_profile")
        .update(updates)
        .eq("id", user.id);

      if (updateError) {
        console.error("Error updating user_profile weight & unit:", updateError);
        Alert.alert("Error", "Failed to update weight unit preference.");
      } else {
        console.log(`Weight successfully converted from ${dbUnit} to ${targetUnit}:`, updates);
        invalidateMainDashboardCache();
        try {
          const { globalWeightCache } = require("../weightscreen/WeightTrackerScreen");
          if (globalWeightCache) {
            globalWeightCache.lastFetchTime = 0;
            globalWeightCache.cachedData = null;
          }
        } catch (_) {}
      }

      // Update weight logs
      await convertWeightLogs(dbUnit, targetUnit, user.id);
    } catch (err) {
      console.error("Exception in handleWeightUnitChange:", err);
    } finally {
      isConvertingWeightRef.current = false;
    }
  };

  const handleHeightUnitChange = async (targetUnit) => {
    if (targetUnit === heightUnit) return;
    if (isConvertingHeightRef.current) return;
    isConvertingHeightRef.current = true;

    const oldUnit = heightUnit;
    console.log(`Height unit changing from ${oldUnit} to ${targetUnit}`);

    // Update UI & Cache immediately
    setHeightUnit(targetUnit);
    globalPreferencesCache.heightUnit = targetUnit;
    AsyncStorage.setItem("@calora_pref_height_unit", targetUnit).catch(() => {});

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        isConvertingHeightRef.current = false;
        return;
      }

      const { data: profile, error } = await supabase
        .from("user_profile")
        .select("height, height_unit")
        .eq("id", user.id)
        .single();

      if (error || !profile) {
        console.error("Error fetching profile for height conversion:", error);
        isConvertingHeightRef.current = false;
        return;
      }

      const dbUnit = profile.height_unit || oldUnit || "cm";

      // If DB is already in targetUnit, avoid re-converting numbers
      if (dbUnit === targetUnit) {
        console.log(`DB height_unit is already ${targetUnit}, skipping conversion`);
        isConvertingHeightRef.current = false;
        return;
      }

      const updates = { height_unit: targetUnit };
      if (profile.height != null) {
        updates.height = convertHeight(Number(profile.height), dbUnit, targetUnit);
      }

      // Atomically update user_profile in one single call
      const { error: updateError } = await supabase
        .from("user_profile")
        .update(updates)
        .eq("id", user.id);

      if (updateError) {
        console.error("Error updating user_profile height & unit:", updateError);
        Alert.alert("Error", "Failed to update height unit preference.");
      } else {
        console.log(`Height successfully converted from ${dbUnit} to ${targetUnit}:`, updates);
        invalidateMainDashboardCache();
      }
    } catch (err) {
      console.error("Exception in handleHeightUnitChange:", err);
    } finally {
      isConvertingHeightRef.current = false;
    }
  };

  const convertWeightLogs = async (fromUnit, toUnit, userId) => {
    if (!userId || fromUnit === toUnit) return;
    try {
      const { data: logs, error } = await supabase
        .from("weight_logs")
        .select("id, weight")
        .eq("user_id", userId);

      if (error || !logs || logs.length === 0) return;

      const updatePromises = logs.map((log) => {
        if (log.weight != null) {
          const newWeight = convertWeight(Number(log.weight), fromUnit, toUnit);
          return supabase
            .from("weight_logs")
            .update({ weight: newWeight })
            .eq("id", log.id);
        }
        return Promise.resolve();
      });

      await Promise.all(updatePromises);
      console.log("Weight logs converted successfully");
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
