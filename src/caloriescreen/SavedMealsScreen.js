import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo, useState } from "react";
import {
    Alert,
    BackHandler,
    FlatList,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import supabase from "../lib/supabase";

// Global cache for saved meals data
const globalSavedMealsCache = {
  cachedData: null,
  lastFetchTime: 0,
  isFetching: false,
  CACHE_DURATION: 60000,
  STALE_TIME: 10000,
  cacheHits: 0,
  cacheMisses: 0,
};

const FILTERS = ["All Meals", "High Protein", "Low Carb", "Under 400 kcal"];

const placeholderImg =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop";

const SavedMealsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [meals, setMeals] = useState(
    () => globalSavedMealsCache.cachedData?.meals || [],
  );
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All Meals");
  const [loading, setLoading] = useState(
    () => !globalSavedMealsCache.cachedData,
  );

  const shouldForceRefresh = route?.params?.refresh === true;

  useFocusEffect(
    useCallback(() => {
      if (shouldForceRefresh) {
        globalSavedMealsCache.cachedData = null;
        globalSavedMealsCache.lastFetchTime = 0;
        if (route?.params?.refresh) {
          navigation.setParams({ refresh: false });
        }
      }

      const now = Date.now();
      const timeSinceLastFetch = now - globalSavedMealsCache.lastFetchTime;
      const isStale = timeSinceLastFetch > globalSavedMealsCache.STALE_TIME;
      const isFresh = timeSinceLastFetch < globalSavedMealsCache.CACHE_DURATION;

      if (!shouldForceRefresh && globalSavedMealsCache.cachedData && isFresh) {
        setMeals(globalSavedMealsCache.cachedData.meals || []);
        setLoading(false);
        globalSavedMealsCache.cacheHits++;
        return;
      }

      if (
        !shouldForceRefresh &&
        globalSavedMealsCache.cachedData &&
        isStale &&
        !isFresh
      ) {
        setMeals(globalSavedMealsCache.cachedData.meals || []);
        setLoading(false);
        globalSavedMealsCache.cacheHits++;
      }

      if (globalSavedMealsCache.isFetching) return;

      globalSavedMealsCache.isFetching = true;
      globalSavedMealsCache.cacheMisses++;

      const fetchMeals = async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          const userId = session?.user?.id;

          if (!userId) {
            globalSavedMealsCache.cachedData = { meals: [] };
            setMeals([]);
            setLoading(false);
            return;
          }

          const { data, error } = await supabase
            .from("saved_meal")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

          if (error || !data) {
            globalSavedMealsCache.cachedData = { meals: [] };
            setMeals([]);
            setLoading(false);
            return;
          }

          const mapped = await Promise.all(
            data.map(async (log) => {
              let imageUrl = placeholderImg;

              if (log.photo_url && !log.photo_url.startsWith("http")) {
                try {
                  const { data: signedUrlData } = await supabase.storage
                    .from("food-photos")
                    .createSignedUrl(log.photo_url, 60 * 60);

                  if (signedUrlData?.signedUrl) {
                    imageUrl = signedUrlData.signedUrl;
                  }
                } catch (error) {}
              } else if (log.photo_url && log.photo_url.startsWith("http")) {
                imageUrl = log.photo_url;
              }

              return {
                id: log.id,
                dish_name: log.dish_name,
                total_nutrition: { calories: Number(log.calories) },
                macros: {
                  protein: Number(log.protein || 0),
                  carbs: Number(log.carbs || 0),
                  fat: Number(log.fat || 0),
                  fiber: Number(log.fiber || 0),
                },
                image: imageUrl,
              };
            }),
          );

          const newDataString = JSON.stringify(mapped);
          const currentDataString = JSON.stringify(meals);

          if (newDataString !== currentDataString) {
            setMeals(mapped);
          }

          globalSavedMealsCache.cachedData = { meals: mapped };
          globalSavedMealsCache.lastFetchTime = Date.now();
          setLoading(false);
        } catch (error) {
        } finally {
          globalSavedMealsCache.isFetching = false;
        }
      };

      fetchMeals();
    }, [meals, shouldForceRefresh, navigation, route]),
  );

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate("Home");
        }
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );

      return () => subscription.remove();
    }, [navigation])
  );

  const filteredMeals = meals.filter((meal) => {
    const matchesSearch = meal.dish_name
      .toLowerCase()
      .includes(search.toLowerCase());

    let matchesFilter = true;
    if (selectedFilter === "High Protein") {
      matchesFilter = meal.macros.protein > 20;
    } else if (selectedFilter === "Low Carb") {
      matchesFilter = meal.macros.carbs < 20;
    } else if (selectedFilter === "Under 400 kcal") {
      matchesFilter = meal.total_nutrition.calories < 400;
    }

    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (idx) => {
    try {
      const mealToDelete = meals[idx];
      if (!mealToDelete || !mealToDelete.id) {
        Alert.alert("Error", "Cannot delete this meal.");
        return;
      }

      const updatedMeals = meals.filter((_, i) => i !== idx);
      setMeals(updatedMeals);

      if (globalSavedMealsCache.cachedData) {
        globalSavedMealsCache.cachedData.meals = updatedMeals;
        globalSavedMealsCache.lastFetchTime = Date.now();
      }

      const { error } = await supabase
        .from("saved_meal")
        .delete()
        .eq("id", mealToDelete.id);

      if (error) {
        setMeals(meals);
        if (globalSavedMealsCache.cachedData) {
          globalSavedMealsCache.cachedData.meals = meals;
        }
        Alert.alert("Error", "Failed to delete meal from database.");
        return;
      }

      Alert.alert("Success", "Meal deleted successfully!");
    } catch (error) {
      setMeals(meals);
      if (globalSavedMealsCache.cachedData) {
        globalSavedMealsCache.cachedData.meals = meals;
      }
      Alert.alert("Error", "Failed to delete meal.");
    }
  };

  const handleAddToPlan = async (meal) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user_id = session?.user?.id;

      if (!user_id) {
        Alert.alert("You must be logged in to log food.");
        return;
      }

      const now = new Date();
      const logData = {
        user_id,
        food_name: meal.dish_name,
        serving_size: 1,
        calories: meal.total_nutrition.calories,
        protein: meal.macros.protein,
        carbs: meal.macros.carbs,
        fat: meal.macros.fat,
        fiber: meal.macros.fiber || 0,
        created_at: now.toISOString(),
        meal_type: "Saved Meal",
        notes: "",
        photo_url: meal.image,
      };

      const { error } = await supabase.from("user_food_logs").insert([logData]);
      if (error) throw error;

      const {
        updateHomeScreenCacheOptimistic,
      } = require("../utils/cacheManager");
      updateHomeScreenCacheOptimistic(logData);

      Alert.alert("Success", "Meal added to today's plan!", [
        {
          text: "OK",
          onPress: () => {
            if (navigation && navigation.navigate) {
              navigation.navigate("Home", { refresh: true });
            }
          },
        },
      ]);
    } catch (e) {
      console.error("Error adding meal to plan:", e);
      Alert.alert("Error", "Failed to add meal to plan.");
    }
  };

  const getSummaryStats = () => {
    const totalMeals = filteredMeals.length;
    const avgCalories =
      totalMeals > 0
        ? Math.round(
            filteredMeals.reduce(
              (sum, meal) => sum + (meal.total_nutrition.calories || 0),
              0,
            ) / totalMeals,
          )
        : 0;
    const avgProtein =
      totalMeals > 0
        ? Math.round(
            filteredMeals.reduce(
              (sum, meal) => sum + (meal.macros.protein || 0),
              0,
            ) / totalMeals,
          )
        : 0;

    return { totalMeals, avgCalories, avgProtein };
  };

  const stats = getSummaryStats();

  const renderMeal = ({ item, index }) => (
    <View style={styles.mealCard}>
      <View style={styles.cardImageShell}>
        <Image
          source={{ uri: item.image || placeholderImg }}
          style={styles.mealImg}
        />
        <View style={styles.imageOverlay} />

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(index)}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={16} color="#F4FBFA" />
        </TouchableOpacity>

        <View style={styles.calorieBadge}>
          <MaterialCommunityIcons
            name="fire"
            size={14}
            color="#F4FBFA"
            style={{ marginRight: 4 }}
          />
          <Text style={styles.calorieBadgeText}>
            {item.total_nutrition.calories} kcal
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.mealName}>
          {item.dish_name}
        </Text>

        <View style={styles.macroStrip}>
          <View style={styles.macroPill}>
            <Text style={styles.macroPillLabel}>P</Text>
            <Text style={styles.macroPillValue}>{item.macros.protein}g</Text>
          </View>

          <View style={styles.macroPill}>
            <Text style={styles.macroPillLabel}>C</Text>
            <Text style={styles.macroPillValue}>{item.macros.carbs}g</Text>
          </View>

          <View style={styles.macroPill}>
            <Text style={styles.macroPillLabel}>F</Text>
            <Text style={styles.macroPillValue}>{item.macros.fat}g</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addToPlanBtn}
          onPress={() => handleAddToPlan(item)}
          activeOpacity={0.85}
        >
          <Text style={styles.addToPlanText}>Add to Plan</Text>
          <Ionicons
            name="arrow-forward"
            size={16}
            color="#F4FBFA"
            style={{ marginLeft: 6 }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("Home");
              }
            }}
            style={styles.headerIconBtn}
            activeOpacity={0.8}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={styles.$iconPrimary}
            />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>Meal library</Text>
            <Text style={styles.headerTitle}>Saved Meals</Text>
          </View>

          <View style={styles.headerIconBtnGhost}>
            <Ionicons
              name="bookmark-outline"
              size={18}
              color={styles.$iconMuted}
            />
          </View>
        </View>

        <View style={styles.heroPanel}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroTitle}>Your reusable meals</Text>
            <View style={styles.heroDot} />
          </View>

          

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stats.totalMeals}</Text>
              <Text style={styles.summaryLabel}>Visible meals</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stats.avgCalories}</Text>
              <Text style={styles.summaryLabel}>Avg kcal</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stats.avgProtein}g</Text>
              <Text style={styles.summaryLabel}>Avg protein</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={styles.$iconMuted} />
          <TextInput
            style={styles.searchBar}
            placeholder="Search saved meals"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.filterHeaderRow}>
          <View style={styles.filterTag}>
            <Ionicons
              name="options-outline"
              size={15}
              color={styles.$iconPrimary}
            />
            <Text style={styles.filterTagText}>Smart filters</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, selectedFilter === f && styles.chipActive]}
              onPress={() => setSelectedFilter(f)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedFilter === f && styles.chipTextActive,
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredMeals}
        renderItem={renderMeal}
        keyExtractor={(item, idx) => item?.id?.toString?.() || idx.toString()}
        numColumns={2}
        columnWrapperStyle={filteredMeals.length > 0 ? styles.columnWrap : null}
        contentContainerStyle={[
          styles.grid,
          { paddingBottom: insets.bottom >= 20 ? insets.bottom + 32 : 32 },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name="restaurant-outline"
                size={28}
                color={styles.$iconPrimary}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {loading ? "Loading meals..." : "No saved meals found"}
            </Text>
            <Text style={styles.emptyText}>
              {loading
                ? "Please wait while your saved meals are being prepared."
                : "Try another search or filter, or save a meal first."}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const createStyles = (colors, isDark) => {
  const primary = "#1F4E4A";
  const mint = "#A8D5CE";
  const background = "#F4FBFA";
  const surface = isDark ? colors.cardBackground : "#FFFFFF";
  const surfaceSoft = isDark ? colors.cardBackground : "#EEF7F5";
  const border = isDark ? colors.border : "#D5E8E3";
  const text = isDark ? colors.textPrimary : "#163633";
  const muted = isDark ? colors.textSecondary : "#5F7E79";
  const faint = isDark ? colors.textMuted : "#7F9B96";

  const shadowColor = isDark ? "#000000" : "#103632";

  return StyleSheet.create({
    $iconPrimary: primary,
    $iconMuted: muted,

    container: {
      flex: 1,
      backgroundColor: background,
    },

    headerWrap: {
      backgroundColor: background,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 14,
    },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
    },

    headerIconBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#EAF4F2",
      borderWidth: 1,
      borderColor: border,
    },

    headerIconBtnGhost: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#F0F8F7",
      borderWidth: 1,
      borderColor: border,
    },

    headerCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
    },

    headerEyebrow: {
      fontSize: 12,
      color: faint,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: 2,
      fontWeight: "600",
    },

    headerTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: text,
    },

    heroPanel: {
      backgroundColor: primary,
      borderRadius: 28,
      padding: 16,
      shadowColor,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.22 : 0.12,
      shadowRadius: 24,
      elevation: 6,
      overflow: "hidden",
    },

    heroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },

    heroTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: "#F4FBFA",
      flex: 1,
      marginRight: 10,
    },

    heroDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: mint,
    },

    heroSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: "rgba(244,251,250,0.82)",
      marginBottom: 14,
    },

    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },

    summaryCard: {
      flex: 1,
      backgroundColor: "rgba(244,251,250,0.10)",
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 10,
      marginRight: 10,
      borderWidth: 1,
      borderColor: "rgba(168,213,206,0.18)",
    },

    summaryValue: {
      fontSize: 20,
      fontWeight: "800",
      color: "#F4FBFA",
      marginBottom: 4,
      textAlign: "center",
    },

    summaryLabel: {
      fontSize: 12,
      color: "rgba(244,251,250,0.74)",
      textAlign: "center",
    },

    searchSection: {
      paddingHorizontal: 20,
      paddingBottom: 10,
    },

    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#FFFFFF",
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 4,
      borderWidth: 1,

      shadowColor,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.15 : 0.05,
      shadowRadius: 12,
      elevation: 2,
      marginBottom: 14,
    },

    searchBar: {
      flex: 1,
      paddingVertical: 14,
      paddingLeft: 10,
      fontSize: 15,
      color: text,
    },

    filterHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },

    filterTag: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#EAF4F2",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,

      alignSelf: "flex-start",
    },

    filterTagText: {
      marginLeft: 6,
      color: primary,
      fontSize: 13,
      fontWeight: "700",
    },

    chipsRow: {
      paddingRight: 20,
      paddingBottom: 4,
    },

    chip: {
      backgroundColor: "#FFFFFF",
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginRight: 10,
      borderWidth: 1,
    },

    chipActive: {
      backgroundColor: primary,
      borderColor: primary,
    },

    chipText: {
      color: text,
      fontSize: 14,
      fontWeight: "600",
    },

    chipTextActive: {
      color: "#F4FBFA",
    },

    grid: {
      paddingHorizontal: 20,
      paddingTop: 6,
    },

    columnWrap: {
      justifyContent: "space-between",
      marginBottom: 14,
    },

    mealCard: {
      width: "48%",
      backgroundColor: surface,
      borderRadius: 24,
      overflow: "hidden",
      borderWidth: 1,

      shadowColor,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.18 : 0.08,
      shadowRadius: 18,
      elevation: 3,
    },

    cardImageShell: {
      position: "relative",
      height: 146,
      backgroundColor: surfaceSoft,
    },

    mealImg: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },

    imageOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(18, 50, 47, 0.10)",
    },

    deleteBtn: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(31,78,74,0.88)",
      borderWidth: 1,
      borderColor: "rgba(244,251,250,0.18)",
      zIndex: 2,
    },

    calorieBadge: {
      position: "absolute",
      left: 10,
      bottom: 10,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(31,78,74,0.92)",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },

    calorieBadgeText: {
      color: "#F4FBFA",
      fontWeight: "700",
      fontSize: 12,
    },

    cardBody: {
      padding: 14,
    },

    mealName: {
      fontSize: 16,
      fontWeight: "800",
      color: text,
      minHeight: 42,
      marginBottom: 12,
      lineHeight: 21,
    },

    macroStrip: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 14,
    },

    macroPill: {
      flex: 1,
      backgroundColor: "#EEF7F5",
      borderRadius: 14,
      paddingVertical: 8,
      paddingHorizontal: 6,
      alignItems: "center",
      marginRight: 6,
      borderWidth: 1,
    },

    macroPillLabel: {
      fontSize: 10,
      color: muted,
      fontWeight: "700",
      marginBottom: 2,
    },

    macroPillValue: {
      fontSize: 13,
      color: primary,
      fontWeight: "800",
    },

    addToPlanBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: primary,
      borderRadius: 16,
      paddingVertical: 12,
    },

    addToPlanText: {
      color: "#F4FBFA",
      fontWeight: "800",
      fontSize: 14,
    },

    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 70,
      paddingHorizontal: 24,
    },

    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "#EAF4F2",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      borderWidth: 1,
    },

    emptyTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: text,
      marginBottom: 8,
      textAlign: "center",
    },

    emptyText: {
      fontSize: 14,
      color: muted,
      lineHeight: 21,
      textAlign: "center",
      maxWidth: 280,
    },
  });
};

// Export cache for external access
export { globalSavedMealsCache };

export default SavedMealsScreen;
