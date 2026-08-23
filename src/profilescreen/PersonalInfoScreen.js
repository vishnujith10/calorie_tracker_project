import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import supabase from "../lib/supabase";

const PersonalInfoScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const palette = useMemo(
    () => createPalette(colors, isDark),
    [colors, isDark],
  );
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [todayCalories, setTodayCalories] = useState(0);
  const [activeDays, setActiveDays] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [weightUnit, setWeightUnit] = useState("kg");
  const [heightUnit, setHeightUnit] = useState("cm");

  useEffect(() => {
    fetchTodayData();
    fetchUserProfile();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchUserProfile();
    }, []),
  );

  const fetchTodayData = async () => {
    try {
      setIsLoading(true);

      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        23,
        59,
        59,
      );

      const { data: foodLogs, error: foodError } = await supabase
        .from("user_food_logs")
        .select("calories")
        .gte("created_at", startOfDay.toISOString())
        .lte("created_at", endOfDay.toISOString());

      if (foodError) {
        console.error("Error fetching food logs:", foodError);
      } else {
        const totalCalories =
          foodLogs?.reduce((sum, log) => sum + (log.calories || 0), 0) || 0;
        setTodayCalories(totalCalories);
      }

      const userCreationDate = new Date("2024-07-11");

      const { data: activeDaysData, error: activeDaysError } = await supabase
        .from("user_food_logs")
        .select("created_at")
        .gte("created_at", userCreationDate.toISOString());

      if (activeDaysError) {
        console.error("Error fetching active days:", activeDaysError);
      } else {
        const uniqueDays = new Set();
        activeDaysData?.forEach((log) => {
          const date = new Date(log.created_at).toDateString();
          uniqueDays.add(date);
        });
        setActiveDays(uniqueDays.size);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error } = await supabase
          .from("user_profile")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error fetching user profile:", error);
        } else {
          setUserProfile(profile);
          setWeightUnit(profile?.weight_unit || "kg");
          setHeightUnit(profile?.height_unit || "cm");
        }
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const handleEdit = (field, currentValue) => {
    setEditingField(field);
    setEditValues((prev) => ({ ...prev, [field]: currentValue || "" }));
  };

  const handleSave = async (field) => {
    try {
      const newValue = editValues[field];

      if (!newValue || newValue.toString().trim() === "") {
        Alert.alert("Error", "Please enter a valid value");
        return;
      }

      setUserProfile((prev) => ({
        ...prev,
        [field]: newValue,
      }));

      const { error } = await supabase
        .from("user_profile")
        .update({ [field]: newValue })
        .eq("name", "Vishnujith");

      if (error) {
        console.error("Error updating profile:", error);
        Alert.alert("Error", "Failed to update profile");
        setUserProfile((prev) => ({
          ...prev,
          [field]: userProfile[field],
        }));
      } else {
        Alert.alert("Success", "Profile updated successfully");
      }

      setEditingField(null);
      setEditValues((prev) => {
        const newValues = { ...prev };
        delete newValues[field];
        return newValues;
      });
    } catch (error) {
      console.error("Error saving field:", error);
      Alert.alert("Error", "Failed to save changes");
    }
  };

  const handleCancel = (field) => {
    setEditingField(null);
    setEditValues((prev) => {
      const newValues = { ...prev };
      delete newValues[field];
      return newValues;
    });
  };

  const renderEditableField = (
    field,
    label,
    currentValue,
    unit = "",
    iconName,
  ) => {
    const isEditing = editingField === field;
    const value =
      editValues[field] !== undefined ? editValues[field] : currentValue;

    return (
      <View style={styles.infoRow}>
        <TouchableOpacity style={styles.infoRowMain} activeOpacity={1}>
          <View style={styles.infoIconWrap}>
            <Ionicons name={iconName} size={18} color={palette.primary} />
          </View>

          <View style={styles.infoTextWrap}>
            <Text style={styles.infoLabel}>{label}</Text>

            {isEditing ? (
              <View style={styles.editShell}>
                <TextInput
                  style={styles.editInput}
                  value={value?.toString() || ""}
                  onChangeText={(text) =>
                    setEditValues((prev) => ({ ...prev, [field]: text }))
                  }
                  placeholder={`Enter ${label.toLowerCase()}`}
                  placeholderTextColor={palette.placeholder}
                  autoFocus
                />
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={() => handleSave(field)}
                  >
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={palette.successText}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => handleCancel(field)}
                  >
                    <Ionicons
                      name="close"
                      size={16}
                      color={palette.errorText}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.infoValue}>
                {currentValue ? `${currentValue}${unit}` : "Not set"}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {!isEditing && (
          <TouchableOpacity
            style={styles.editPill}
            onPress={() => handleEdit(field, currentValue)}
          >
            <Ionicons name="pencil-outline" size={15} color={palette.primary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={palette.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerEyebrow}>Profile</Text>
          <Text style={styles.headerTitle}>Personal Info</Text>
        </View>

        <View style={styles.headerGhost} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{
          paddingBottom: insets.bottom >= 20 ? insets.bottom + 24 : 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroCaption}>Your wellness identity</Text>
              <Text style={styles.heroName}>
                {userProfile?.name || "Your Profile"}
              </Text>
            </View>
            <View style={styles.heroBadge}>
              <Ionicons
                name="sparkles-outline"
                size={16}
                color={palette.primary}
              />
              <Text style={styles.heroBadgeText}>Live</Text>
            </View>
          </View>

          <Text style={styles.heroSubtext}>
            Update your core body stats and fitness preferences without
            affecting your saved progress.
          </Text>
        </View>

        <View style={styles.blockSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Body details</Text>
              <Text style={styles.sectionTitle}>Personal information</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            {renderEditableField(
              "age",
              "Age",
              userProfile?.age,
              "",
              "person-outline",
            )}
            {renderEditableField(
              "weight",
              "Weight",
              userProfile?.weight,
              ` ${weightUnit}`,
              "fitness-outline",
            )}
            {renderEditableField(
              "target_weight",
              "Goal Weight",
              userProfile?.target_weight,
              ` ${weightUnit}`,
              "trending-up-outline",
            )}
            {renderEditableField(
              "height",
              "Height",
              userProfile?.height,
              ` ${heightUnit}`,
              "resize-outline",
            )}
            {renderEditableField(
              "date_of_birth",
              "Date of Birth",
              userProfile?.date_of_birth,
              "",
              "calendar-outline",
            )}
            {renderEditableField(
              "gender",
              "Gender",
              userProfile?.gender,
              "",
              "male-female-outline",
            )}
          </View>
        </View>

        <View style={styles.blockSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Targets</Text>
              <Text style={styles.sectionTitle}>Fitness goals</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            {renderEditableField(
              "total_days_per_week",
              "Weekly Workout Frequency",
              userProfile?.total_days_per_week,
              " workouts/week",
              "calendar-outline",
            )}
            {renderEditableField(
              "calorie_goal",
              "Target Calories",
              userProfile?.calorie_goal,
              " calories/day",
              "flame-outline",
            )}
            {renderEditableField(
              "prefered_workout",
              "Preferred Workout Types",
              userProfile?.prefered_workout,
              "",
              "barbell-outline",
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createPalette = (themeColors, isDark) => ({
  background: isDark ? "#10312E" : "#F4FBFA",
  surface: isDark ? "#163B38" : "#FFFFFF",
  surfaceSoft: isDark ? "#1B4743" : "#EEF7F5",
  surfaceMuted: isDark ? "#214F4B" : "#E5F3F0",
  primary: "#1F4E4A",
  primaryDeep: "#163E3B",
  primarySoft: "#A8D5CE",
  primaryBorder: isDark ? "#3D6B66" : "#D5E8E3",
  textPrimary: isDark ? "#F4FBFA" : "#163633",
  textSecondary: isDark ? "#C6E2DD" : "#5B7873",
  textMuted: isDark ? "#9FC1BB" : "#7D9994",
  onPrimary: "#F4FBFA",
  border: isDark ? "#2C5A56" : "#D5E8E3",
  icon: isDark ? "#C6E2DD" : "#5B7873",
  placeholder: isDark ? "#88AAA4" : "#8DA7A2",
  shadow: "#1F4E4A",
  successBg: isDark ? "rgba(168,213,206,0.18)" : "#E6F4F1",
  successText: "#1F4E4A",
  errorBg: isDark ? "rgba(31,78,74,0.14)" : "#EDF6F4",
  errorText: "#1F4E4A",
  editContainerBg: isDark ? "#214845" : "#F8FCFB",
  editInputBg: isDark ? "#183D3A" : "#FFFFFF",
});

const createStyles = (palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 8,
      backgroundColor: palette.background,
    },
    headerIconButton: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: palette.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 2,
    },
    headerCenter: {
      alignItems: "center",
    },
    headerEyebrow: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1.1,
      textTransform: "uppercase",
      color: palette.textMuted,
      marginBottom: 2,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: palette.textPrimary,
    },
    headerGhost: {
      width: 44,
      height: 44,
    },

    content: {
      flex: 1,
      paddingHorizontal: 20,
    },

    heroCard: {
      backgroundColor: palette.primary,
      borderRadius: 28,
      padding: 22,
      marginTop: 14,
      marginBottom: 22,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
      elevation: 4,
    },
    heroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 16,
    },
    heroCaption: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: "#D7EEEA",
      marginBottom: 6,
    },
    heroName: {
      fontSize: 28,
      fontWeight: "700",
      color: palette.onPrimary,
    },
    heroBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#E4F3F0",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      gap: 6,
    },
    heroBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: palette.primary,
    },
    heroSubtext: {
      fontSize: 14,
      lineHeight: 21,
      color: "#DDF2EE",
      marginBottom: 20,
    },

    statsGrid: {
      flexDirection: "row",
      gap: 12,
    },
    statTilePrimary: {
      flex: 1.1,
      backgroundColor: palette.primaryDeep,
      borderRadius: 22,
      padding: 18,
      minHeight: 150,
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: "rgba(244,251,250,0.12)",
    },
    statColumn: {
      flex: 0.9,
      justifyContent: "space-between",
    },
    statTileSecondary: {
      backgroundColor: palette.surfaceSoft,
      borderRadius: 20,
      padding: 16,
      minHeight: 69,
      justifyContent: "center",
    },
    statOverline: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.9,
      color: "#BFE1DA",
    },
    statNumberPrimary: {
      fontSize: 30,
      fontWeight: "800",
      color: palette.onPrimary,
      marginTop: 8,
      marginBottom: 6,
    },
    statMetaPrimary: {
      fontSize: 13,
      color: "#CFE7E3",
      fontWeight: "500",
    },
    statOverlineSecondary: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      color: palette.textMuted,
      marginBottom: 8,
    },
    statNumberSecondary: {
      fontSize: 22,
      fontWeight: "700",
      color: palette.primary,
    },

    blockSection: {
      marginBottom: 22,
    },
    sectionHeaderRow: {
      marginBottom: 12,
      paddingHorizontal: 2,
    },
    sectionEyebrow: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: palette.textMuted,
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: palette.textPrimary,
    },

    sectionCard: {
      backgroundColor: palette.surface,
      borderRadius: 26,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: palette.primaryBorder,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.07,
      shadowRadius: 16,
      elevation: 2,
    },

    infoRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: palette.surfaceMuted,
    },
    infoRowMain: {
      flex: 1,
      flexDirection: "row",
      alignItems: "flex-start",
    },
    infoIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: palette.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    infoTextWrap: {
      flex: 1,
      marginLeft: 14,
      paddingRight: 12,
    },
    infoLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: palette.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.7,
      marginBottom: 6,
    },
    infoValue: {
      fontSize: 17,
      fontWeight: "600",
      color: palette.textPrimary,
      lineHeight: 24,
    },
    editPill: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: palette.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
      marginTop: 2,
    },

    editShell: {
      marginTop: 4,
      backgroundColor: palette.editContainerBg,
      borderRadius: 18,
      padding: 10,
      borderWidth: 1,
      borderColor: palette.border,
    },
    editInput: {
      width: "100%",
      paddingVertical: 12,
      paddingHorizontal: 12,
      fontSize: 15,
      color: palette.textPrimary,
      backgroundColor: palette.editInputBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.border,
      marginBottom: 10,
    },
    editActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
    },
    saveButton: {
      minWidth: 44,
      height: 40,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: palette.successBg,
      borderWidth: 1,
      borderColor: palette.primaryBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelButton: {
      minWidth: 44,
      height: 40,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: palette.errorBg,
      borderWidth: 1,
      borderColor: palette.primaryBorder,
      alignItems: "center",
      justifyContent: "center",
    },
  });

export default PersonalInfoScreen;
