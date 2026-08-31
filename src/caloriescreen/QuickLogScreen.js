import { Ionicons } from "@expo/vector-icons";
import { GoogleGenerativeAI } from "@google/generative-ai";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import supabase from "../lib/supabase";

// Use environment variables directly (from eas.json in production or EAS Secrets)
const apiKey =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY;

// Debug logging
console.log("QuickLogScreen - API Key:", apiKey ? "Found" : "Missing");
console.log(
  "QuickLogScreen - process.env:",
  process.env.EXPO_PUBLIC_GEMINI_API_KEY ? "Found" : "Missing",
);
console.log(
  "QuickLogScreen - Constants:",
  Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY ? "Found" : "Missing",
);
console.log("QuickLogScreen - Full Constants:", Constants.expoConfig?.extra);

// Validate API key
if (!apiKey) {
  console.error("QuickLogScreen - No API key found!");
  throw new Error(
    "AI service configuration error. Please check your settings.",
  );
}

const genAI = new GoogleGenerativeAI(apiKey);

// Shared palette — mirrors the teal design system used across the app
// (Home dashboard, Weight Tracker, Add Weight, Journal/Timeline, Daily Check-in,
// Deep Insights, Food Analysis, etc.)
const createPalette = (isDark) => ({
  primary: "#1F4E4A",
  primaryMuted: "#3D6A66",
  primaryLight: "#A8D5CE",
  background: isDark ? "#0F1E1C" : "#F4FBFA",
  card: isDark ? "#17302D" : "#FFFFFF",
  cardSecondary: isDark ? "#1C3935" : "#EEF7F5",
  cardTertiary: isDark ? "#21413D" : "#E8F3F1",
  textPrimary: isDark ? "#F4FBFA" : "#163633",
  textSecondary: isDark ? "#BED9D3" : "#5B7873",
  textMuted: isDark ? "#8FAAA5" : "#7D9994",
  border: isDark ? "#2C4A46" : "#D5E8E3",
  borderStrong: isDark ? "#466963" : "#BFD8D3",
  shadow: "#102624",
  tipAccent: isDark ? "#F0C177" : "#B8863A",
  tipAccentBg: isDark ? "#2C2717" : "#FBF1E1",
  tipAccentBorder: isDark ? "#4A3F25" : "#F0DDB8",
});

async function getCachedAnalysis(mealText) {
  const key = "quicklog_cache_" + mealText.trim().toLowerCase();
  const cached = await AsyncStorage.getItem(key);
  return cached ? JSON.parse(cached) : null;
}
async function setCachedAnalysis(mealText, data) {
  const key = "quicklog_cache_" + mealText.trim().toLowerCase();
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

export default function QuickLogScreen({ navigation }) {
  const { isDark } = useTheme();
  const palette = useMemo(() => createPalette(isDark), [isDark]);
  const styles = useMemo(
    () => createStyles(palette, isDark),
    [palette, isDark],
  );
  const [mealText, setMealText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const tips = [
    {
      icon: "🍎",
      title: "Portion Control",
      tip: "Use your hand as a guide: palm = protein, fist = veggies, cupped hand = carbs, thumb = fats.",
      color: "#FFF5F5",
      text: "#B42318",
      border: "#FECDCA",
    },
    {
      icon: "💧",
      title: "Stay Hydrated",
      tip: "Drink water before meals. Thirst is often mistaken for hunger.",
      color: "#EFF8FF",
      text: "#175CD3",
      border: "#B2DDFF",
    },
    {
      icon: "🍽️",
      title: "Mindful Eating",
      tip: "Eat slowly and without distractions. It takes ~20 minutes to feel full.",
      color: "#ECFDF3",
      text: "#067647",
      border: "#ABEFC6",
    },
    {
      icon: "⚖️",
      title: "Balanced Plate",
      tip: "Half veggies, quarter lean protein, quarter whole grains.",
      color: "#F9F5FF",
      text: "#6941C6",
      border: "#E9D7FE",
    },
    {
      icon: "❤️",
      title: "Healthy Fats",
      tip: "Include nuts, avocados, and olive oil for satiety and heart health.",
      color: "#FFF1F3",
      text: "#C01048",
      border: "#FECDD6",
    },
    {
      icon: "💡",
      title: "Smart Snacking",
      tip: "Pick protein-rich snacks like Greek yogurt or nuts for lasting energy.",
      color: "#FFFAEB",
      text: "#B54708",
      border: "#FEDF89",
    },
  ];

  const currentTip = useMemo(() => {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const diffDays = Math.floor(
      (Date.now() - startOfYear.getTime()) / 86400000,
    );
    return diffDays % tips.length;
  }, [tips.length]);

  const handleAnalyze = async () => {
    if (!mealText.trim()) {
      Alert.alert("No meal entered", "Please type your meal.");
      return;
    }
    setIsLoading(true);
    try {
      // Check cache first
      const cached = await getCachedAnalysis(mealText);
      if (cached) {
        console.log("QuickLogScreen - Using cached analysis:", cached);
        setAnalysis(cached);
        navigation.navigate("PostCalorieScreen", {
          analysis: cached,
          mealName: "",
        });
        return;
      }

      console.log("QuickLogScreen - Analyzing meal text:", mealText);

      // Timeout wrapper for network requests
      const raceWithTimeout = (
        promise,
        ms,
        timeoutMessage = "Request timed out",
      ) => {
        return Promise.race([
          promise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(timeoutMessage)), ms),
          ),
        ]);
      };

      // Use fewer models for faster performance - start with the most reliable one
      const models = [
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
      ];
      let lastError = null;

      for (const modelName of models) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });

          // Use the exact same prompt structure as VoiceCalorieScreen
          const prompt = `Analyze the following meal text: "${mealText}". Your response MUST be a single valid JSON object and nothing else. Do not include markdown formatting like \`\`\`json.

IMPORTANT RULES:
1. If the text does NOT contain any food items or is unclear, respond with: {"error": "No food items detected. Please enter a valid meal."}
2. CRITICAL: ALWAYS preserve the EXACT quantities mentioned in the text (e.g., "200g black beans" → "200g black beans", NOT "1 black beans")
3. Extract ONLY the essential food name and quantity. REMOVE unnecessary words like:
   - "plate of", "bowl of", "cup of", "piece of", "slice of"
   - "some", "a bit of", "portion of"
   - "with", "and", "plus", "along with"
   - "during", "for", "at", "in"
   - Any descriptive words that aren't part of the food name

4. Examples of correct extraction:
   - "200g of black beans" → extract "200g black beans"
   - "2 slices of bread" → extract "2 bread"
   - "1 bowl of rice with chicken" → extract "1 rice" and "1 chicken"
   - "some apples and a sandwich" → extract "1 apple" and "1 sandwich"
   - "3 pieces of pizza" → extract "3 pizza"

5. CRITICAL: ALWAYS preserve EXACT quantities and units mentioned:
   - "200 grams of black beans" → "200g black beans" (NOT "1 black beans")
   - "150g chicken" → "150g chicken" (NOT "1 chicken")
   - "1 cup rice" → "1 cup rice" (NOT "1 rice")
   - "2 slices bread" → "2 bread" (NOT "1 bread")
   - "500ml juice" → "500ml juice" (NOT "1 juice")

6. If no specific quantity is mentioned, assume quantity of 1 (e.g., "1 sandwich", "1 rice")
7. Convert words to numbers: "one" → "1", "two" → "2", "three" → "3", etc.
8. Convert units: "grams" → "g", "milliliters" → "ml", "cups" → "cup", "slices" → "slice"
9. Use CONSISTENT calorie values for similar foods:
   - "omelette", "mini omelette", "egg omelette" → use same calorie value (~90-120 calories per omelette)
   - "bread", "slice of bread", "bread slice" → use same calorie value (~80-100 calories per slice)
   - "apple", "red apple", "green apple" → use same calorie value (~80-100 calories per apple)
   - "rice", "white rice", "cooked rice" → use same calorie value (~200-250 calories per cup)
   - "biryani", "chicken biryani", "vegetable biryani" → use same calorie value (~300-400 calories per serving)
   - "black beans", "beans", "kidney beans" → use same calorie value (~120-150 calories per 100g)
9. CRITICAL: Calculate nutrition values based on the ACTUAL quantities mentioned, not standard serving sizes
10. IMPORTANT: Provide realistic fiber values based on the food type:
    - Fruits and vegetables: 2-8g fiber per serving
    - Whole grains and breads: 2-4g fiber per serving  
    - Legumes and beans: 5-15g fiber per serving
    - Nuts and seeds: 2-6g fiber per serving
    - Processed foods: 0-2g fiber per serving

The JSON object must have this structure: 
{ "transcription": "The meal text you analyzed", "items": [ { "name": "quantity + food item", "calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number>, "fiber": <number> } ], "total": { "calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number>, "fiber": <number> } }`;

          // Add timeout (30 seconds) for network requests
          const result = await raceWithTimeout(
            model.generateContent(prompt),
            30000,
            "Network request timed out. Please check your internet connection and try again.",
          );
          const response = await result.response;
          let text = response.text();
          console.log("QuickLogScreen - AI raw response:", text);

          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jsonString = jsonMatch[0];
            const data = JSON.parse(jsonString);

            // Check for error response
            if (data.error) {
              throw new Error(data.error);
            }

            if (
              !data.total ||
              !Array.isArray(data.items) ||
              !data.transcription
            ) {
              throw new Error("Invalid JSON structure from API.");
            }

            // Check if any food items were detected
            if (data.items.length === 0) {
              throw new Error(
                "No food items detected. Please enter a valid meal.",
              );
            }

            console.log("QuickLogScreen - Parsed analysis data:", data);
            console.log("QuickLogScreen - Items:", data.items);
            console.log("QuickLogScreen - Total nutrition:", data.total);

            // Convert to the same format as VoiceCalorieScreen for PostCalorieScreen
            const analysisData = {
              dish_name: data.items.map((item) => item.name).join(", "),
              description: `A meal containing ${data.items
                .map((item) => item.name)
                .join(", ")}`,
              total_nutrition: {
                calories: data.total.calories,
                protein: data.total.protein,
                fat: data.total.fat,
                carbs: data.total.carbs,
                fiber: data.total.fiber || 0,
              },
              ingredients: data.items.map((item) => ({
                name: item.name,
                calories: item.calories,
              })),
            };

            console.log(
              "QuickLogScreen - Converted analysis data:",
              analysisData,
            );

            setAnalysis(analysisData);
            await setCachedAnalysis(mealText, analysisData);
            navigation.navigate("PostCalorieScreen", {
              analysis: analysisData,
              mealName: "",
            });
            return; // Success, exit the loop
          } else {
            throw new Error(
              "Invalid JSON format from API. No JSON object found.",
            );
          }
        } catch (error) {
          lastError = error;
          console.log(
            `QuickLogScreen - Model ${modelName} failed:`,
            error.message,
          );
          // Continue to next model
        }
      }

      // If all models failed, show error
      throw lastError || new Error("All AI models are currently unavailable.");
    } catch (error) {
      console.error("QuickLogScreen - Analysis error:", error);
      let errorMessage = "Could not analyze the meal.";

      // Network and timeout errors
      if (
        error.message.includes("timed out") ||
        error.message.includes("timeout") ||
        error.message.includes("Network request timed out")
      ) {
        errorMessage =
          "Network error: Connection is slow or timed out. Please check your internet connection and try again.";
      } else if (
        error.message.includes("fetch") ||
        error.message.includes("network") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("ERR_INTERNET_DISCONNECTED")
      ) {
        errorMessage =
          "Network error: Unable to connect. Please check your internet connection and try again.";
      } else if (
        error.message.includes("503") ||
        error.message.includes("overloaded")
      ) {
        errorMessage =
          "AI service is temporarily overloaded. Please try again in a few moments.";
      } else if (error.message.includes("API key")) {
        errorMessage =
          "AI service configuration error. Please check your settings.";
      } else {
        errorMessage += " " + error.message;
      }
      Alert.alert("AI Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogMeal = async () => {
    if (!analysis) {
      Alert.alert("No analysis", "Please analyze the meal first.");
      return;
    }
    try {
      // Save to Supabase (example table: meals)
      const { data, error } = await supabase.from("meals").insert([
        {
          dish_name: analysis.dish_name,
          description: analysis.description,
          calories: analysis.total_nutrition.calories,
          protein: analysis.total_nutrition.protein,
          fat: analysis.total_nutrition.fat,
          carbs: analysis.total_nutrition.carbs,
          ingredients: analysis.ingredients,
        },
      ]);
      if (error) throw error;
      Alert.alert("Success", "Meal saved!");
    } catch (e) {
      Alert.alert("Error", "Failed to save meal.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {/* Small compact loading modal when analyzing (similar to VoiceCalorieScreen) */}
      <Modal
        visible={isLoading}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
      >
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size={40} color={palette.primary} />
            <Text style={styles.loadingTitle}>Processing...</Text>
            <Text style={styles.loadingSubtext}>Analyzing your meal</Text>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Hero header */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.heroBackBtn}
            >
              <Ionicons name="chevron-back" size={22} color={palette.primary} />
            </TouchableOpacity>
            <Text style={styles.heroTitle}>Text to Calorie</Text>
            <View style={styles.heroSpacer} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 18, marginTop: 14 }}>
          {/* Nutrition Tip (now above input) */}
          <View style={styles.tipCard}>
            <View style={styles.tipTopRow}>
              <View style={styles.tipIconShell}>
                <Ionicons
                  name="bulb-outline"
                  size={20}
                  color={palette.tipAccent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tipTitle}>
                  Tip of the Day: {tips[currentTip].title}
                </Text>
                <Text style={styles.tipText}>{tips[currentTip].tip}</Text>
              </View>
            </View>
          </View>

          {/* Input card moved below tips */}
          <View style={styles.cardInput}>
            <TouchableOpacity style={styles.editPill} activeOpacity={0.7}>
              <Ionicons
                name="create-outline"
                size={17}
                color={palette.textMuted}
              />
            </TouchableOpacity>
            {(!mealText || mealText.length === 0) && (
              <Text style={styles.multiPlaceholder} pointerEvents="none">
                {"Describe your meal...\n" +
                  "e.g., A bowl of oatmeal with\n" +
                  "blueberries, a drizzle of honey, and a\n" +
                  "sprinkle of almonds."}
              </Text>
            )}
            <TextInput
              style={styles.input}
              placeholder={""}
              placeholderTextColor={palette.textMuted}
              value={mealText}
              onChangeText={setMealText}
              multiline
            />
          </View>
        </View>
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.analyzeBtn}
            onPress={handleAnalyze}
            disabled={isLoading}
            activeOpacity={0.9}
          >
            {isLoading ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.analyzeBtnText}>Analyzing...</Text>
              </>
            ) : (
              <>
                <Text style={styles.analyzeBtnText}>Convert to Calories</Text>
                <Ionicons
                  name="arrow-forward"
                  size={19}
                  color="#FFFFFF"
                  style={{ marginLeft: 8 }}
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (palette, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },

    // Hero header
    heroCard: {
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 6,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    heroBackBtn: {
      width: 40,
      height: 40,
      borderRadius: 16,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      justifyContent: "center",
    },
    heroTitle: {
      fontSize: 19,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },
    heroSpacer: { width: 40 },

    // Input card
    cardInput: {
      backgroundColor: palette.card,
      borderRadius: 24,
      paddingHorizontal: 18,
      paddingVertical: 16,
      borderWidth: 1,
      borderColor: palette.border,
      position: "relative",
      shadowColor: palette.shadow,
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 14,
      elevation: 3,
      marginTop: 16,
      marginBottom: 16,
    },
    editPill: {
      position: "absolute",
      top: 12,
      right: 12,
      backgroundColor: palette.cardSecondary,
      borderRadius: 12,
      padding: 7,
      borderWidth: 1,
      borderColor: palette.border,
    },
    input: {
      fontSize: 16,
      fontFamily: "Manrope-Regular",
      color: palette.textPrimary,
      minHeight: 130,
    },
    multiPlaceholder: {
      position: "absolute",
      left: 18,
      top: 16,
      right: 18,
      color: palette.textMuted,
      fontSize: 15,
      fontFamily: "Manrope-Regular",
      lineHeight: 22,
    },

    // Tip card
    tipCard: {
      backgroundColor: palette.tipAccentBg,
      borderWidth: 1,
      borderColor: palette.tipAccentBorder,
      borderRadius: 24,
      paddingHorizontal: 18,
      paddingVertical: 18,
    },
    tipTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    tipIconShell: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
      borderWidth: 1,
      borderColor: palette.tipAccentBorder,
    },
    tipTitle: {
      fontSize: 15,
      fontFamily: "Lexend-SemiBold",
      color: palette.tipAccent,
      marginBottom: 6,
    },
    tipText: {
      color: palette.textSecondary,
      fontFamily: "Manrope-Regular",
      lineHeight: 21,
      fontSize: 14,
    },

    // Footer
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      padding: 18,
      backgroundColor: palette.card,
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },
    analyzeBtn: {
      backgroundColor: palette.primary,
      borderRadius: 20,
      paddingVertical: 16,
      paddingHorizontal: 32,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      width: "100%",
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 14,
      elevation: 5,
    },
    analyzeBtnText: {
      color: "#FFFFFF",
      fontFamily: "Lexend-SemiBold",
      fontSize: 16,
    },

    // Loading modal
    loadingOverlay: {
      flex: 1,
      backgroundColor: "rgba(16, 38, 36, 0.55)",
      justifyContent: "center",
      alignItems: "center",
    },
    loadingContainer: {
      backgroundColor: palette.card,
      borderRadius: 24,
      padding: 26,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 200,
      maxWidth: 300,
      borderWidth: 1,
      borderColor: palette.border,
    },
    loadingTitle: {
      marginTop: 16,
      fontSize: 17,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },
    loadingSubtext: {
      marginTop: 6,
      fontSize: 13,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
      textAlign: "center",
    },
  });
