import { Ionicons } from "@expo/vector-icons";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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

// Initialize Gemini AI
const apiKey =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY;

if (!apiKey) {
  console.error("VoicePostCalorieScreen - No API key found!");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Shared palette — mirrors the teal design system used across the app
// (Home dashboard, Weight Tracker, Add Weight, Journal/Timeline, Daily Check-in, Deep Insights, etc.)
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
  destructive: "#B94F4F",
  selectedCard: isDark ? "#1D403B" : "#E6F5F1",
});

const VoicePostCalorieScreen = ({ route, navigation }) => {
  const { analysis, mealName, cleanFoodName } = route.params || {};
  const insets = useSafeAreaInsets(); // Get safe area insets for bottom navigation
  const { isDark } = useTheme();
  const palette = useMemo(() => createPalette(isDark), [isDark]);
  const styles = useMemo(
    () => createStyles(palette, isDark),
    [palette, isDark],
  );

  // Add safety checks for route params
  if (!route.params) {
    console.log("No route params found, using defaults");
  }

  console.log("VoicePostCalorieScreen - Route params:", route.params);
  console.log("VoicePostCalorieScreen - Analysis:", analysis);
  console.log("VoicePostCalorieScreen - Meal name:", mealName);
  console.log("VoicePostCalorieScreen - Clean food name:", cleanFoodName);

  const [macros, setMacros] = useState({
    protein: analysis?.total?.protein || 0,
    carbs: analysis?.total?.carbs || 0,
    fat: analysis?.total?.fat || 0,
    fiber: analysis?.total?.fiber || 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [mealNameState, setMealNameState] = useState(
    cleanFoodName || analysis?.dish_name || mealName || "",
  );
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [logging, setLogging] = useState(false);
  const [selectedMood, setSelectedMood] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState(analysis);

  // Mood options for selection (matching PhotoCalorieScreen)
  const moodOptions = [
    { emoji: "😀", label: "Happy" },
    { emoji: "😊", label: "Content" },
    { emoji: "😐", label: "Neutral" },
    { emoji: "😞", label: "Sad" },
    { emoji: "😴", label: "Tired" },
    { emoji: "😤", label: "Stressed" },
  ];

  // Calculate dynamic health score based on food data and user profile
  const calculateHealthScore = () => {
    const { calories, protein, carbs, fat, fiber } = analysis?.total || {};

    if (!calories || calories === 0)
      return {
        score: 0,
        text: "No Data",
        info: "No nutritional data available",
      };

    let score = 0; // Start from 0 for more realistic scoring

    // Protein balance (ideal: 20-30% of calories)
    const proteinCalories = protein * 4;
    const proteinPercentage = (proteinCalories / calories) * 100;
    if (proteinPercentage >= 20 && proteinPercentage <= 30)
      score += 3; // Excellent protein
    else if (proteinPercentage >= 15 && proteinPercentage <= 35)
      score += 2; // Good protein
    else if (proteinPercentage >= 10 && proteinPercentage <= 40)
      score += 1; // Fair protein
    else if (proteinPercentage < 10) score -= 1; // Very low protein

    // Carb balance (ideal: 45-65% of calories)
    const carbCalories = carbs * 4;
    const carbPercentage = (carbCalories / calories) * 100;
    if (carbPercentage >= 45 && carbPercentage <= 65)
      score += 2.5; // Excellent carbs
    else if (carbPercentage >= 35 && carbPercentage <= 75)
      score += 1.5; // Good carbs
    else if (carbPercentage >= 25 && carbPercentage <= 85)
      score += 0.5; // Fair carbs
    else if (carbPercentage > 85) score -= 1; // Too many carbs

    // Fat balance (ideal: 20-35% of calories)
    const fatCalories = fat * 9;
    const fatPercentage = (fatCalories / calories) * 100;
    if (fatPercentage >= 20 && fatPercentage <= 35)
      score += 2; // Excellent fat
    else if (fatPercentage >= 15 && fatPercentage <= 40)
      score += 1; // Good fat
    else if (fatPercentage >= 10 && fatPercentage <= 45)
      score += 0.5; // Fair fat
    else if (fatPercentage > 45)
      score -= 1; // Too much fat
    else if (fatPercentage < 10) score -= 0.5; // Too little fat

    // Fiber content (good: >10g per meal)
    if (fiber >= 10)
      score += 1.5; // Excellent fiber
    else if (fiber >= 7)
      score += 1; // Good fiber
    else if (fiber >= 5)
      score += 0.5; // Fair fiber
    else if (fiber >= 3)
      score += 0; // Low fiber
    else score -= 0.5; // Very low fiber

    // Calorie appropriateness (assuming 2000 cal daily, ~600-700 per meal)
    if (calories >= 400 && calories <= 800)
      score += 1; // Good calorie range
    else if (calories >= 300 && calories <= 1000)
      score += 0.5; // Acceptable range
    else if (calories < 200 || calories > 1200) score -= 1; // Poor range

    // Cap score between 0 and 10
    score = Math.max(0, Math.min(10, score));

    // Determine health text
    let healthText = "Poor";
    if (score >= 8) healthText = "Excellent";
    else if (score >= 6) healthText = "Good";
    else if (score >= 4) healthText = "Balanced";
    else if (score >= 2) healthText = "Fair";

    // Generate info text based on actual macro percentages
    let infoText = "";

    // Protein feedback
    if (proteinPercentage >= 20 && proteinPercentage <= 30) {
      infoText += "Excellent protein balance. ";
    } else if (proteinPercentage >= 15 && proteinPercentage <= 35) {
      infoText += "Good protein content. ";
    } else if (proteinPercentage >= 10 && proteinPercentage <= 40) {
      infoText += "Fair protein content. ";
    } else if (proteinPercentage < 10) {
      infoText += "Low protein content. ";
    } else {
      infoText += "High protein content. ";
    }

    // Fat feedback
    if (fatPercentage >= 20 && fatPercentage <= 35) {
      infoText += "Good fat balance. ";
    } else if (fatPercentage >= 15 && fatPercentage <= 40) {
      infoText += "Acceptable fat content. ";
    } else if (fatPercentage > 45) {
      infoText += "High in fats. ";
    } else if (fatPercentage < 10) {
      infoText += "Low fat content. ";
    } else {
      infoText += "Moderate fat content. ";
    }

    // Fiber feedback
    if (fiber >= 10) {
      infoText += `Excellent fiber content (${fiber}g).`;
    } else if (fiber >= 7) {
      infoText += `Good fiber content (${fiber}g).`;
    } else if (fiber >= 5) {
      infoText += `Fair fiber content (${fiber}g).`;
    } else if (fiber >= 3) {
      infoText += `Low fiber content (${fiber}g).`;
    } else {
      infoText += `Very low fiber content (${fiber}g).`;
    }

    return {
      score: Math.round(score * 10) / 10,
      text: healthText,
      info: infoText,
    };
  };

  const healthData = calculateHealthScore();
  const healthScore = healthData.score;
  const healthText = healthData.text;
  const infoText = healthData.info;

  // Helper function to get appropriate icon for ingredients
  const getIngredientIcon = (ingredientName) => {
    const name = ingredientName.toLowerCase();
    if (
      name.includes("rice") ||
      name.includes("pasta") ||
      name.includes("bread")
    )
      return "🍚";
    if (
      name.includes("chicken") ||
      name.includes("meat") ||
      name.includes("fish")
    )
      return "🍗";
    if (
      name.includes("vegetable") ||
      name.includes("greens") ||
      name.includes("salad")
    )
      return "🥬";
    if (
      name.includes("fruit") ||
      name.includes("apple") ||
      name.includes("banana")
    )
      return "🍎";
    if (name.includes("juice")) return "🧃";
    if (name.includes("egg")) return "🥚";
    if (
      name.includes("milk") ||
      name.includes("cheese") ||
      name.includes("yogurt")
    )
      return "🥛";
    if (name.includes("nut") || name.includes("seed")) return "🥜";
    if (name.includes("oil") || name.includes("butter") || name.includes("fat"))
      return "🫒";
    return "🍽️"; // default icon
  };

  // Helper function to extract main ingredients from meal name
  const extractMainIngredients = (mealName) => {
    console.log("extractMainIngredients called with:", mealName);
    const name = mealName.toLowerCase();
    console.log("Lowercase meal name:", name);
    const ingredients = [];

    // Indian dishes
    if (name.includes("dosa")) {
      console.log("Found dosa in meal name");
      ingredients.push({ name: "Dosa", amount: "1 piece", icon: "🥞" });
      if (name.includes("masala")) {
        console.log("Found masala in meal name");
        ingredients.push({ name: "Potato Masala", amount: "100g", icon: "🥔" });
      }
      if (name.includes("sambar")) {
        ingredients.push({ name: "Sambar", amount: "50ml", icon: "🥘" });
      }
      if (name.includes("chutney")) {
        ingredients.push({ name: "Chutney", amount: "30ml", icon: "🥗" });
      }
    } else if (name.includes("idli")) {
      ingredients.push({ name: "Idli", amount: "2-3 pieces", icon: "🥞" });
      if (name.includes("sambar")) {
        ingredients.push({ name: "Sambar", amount: "100ml", icon: "🥘" });
      }
      if (name.includes("chutney")) {
        ingredients.push({ name: "Chutney", amount: "50ml", icon: "🥗" });
      }
    } else if (name.includes("biryani")) {
      ingredients.push({ name: "Basmati Rice", amount: "200g", icon: "🍚" });
      if (name.includes("chicken")) {
        ingredients.push({ name: "Chicken", amount: "150g", icon: "🍗" });
      } else if (name.includes("mutton")) {
        ingredients.push({ name: "Mutton", amount: "150g", icon: "🥩" });
      } else if (name.includes("vegetable") || name.includes("veg")) {
        ingredients.push({
          name: "Mixed Vegetables",
          amount: "100g",
          icon: "🥬",
        });
      }
      ingredients.push({ name: "Biryani Spices", amount: "10g", icon: "🌶️" });
    } else if (name.includes("curry")) {
      if (name.includes("chicken")) {
        ingredients.push({ name: "Chicken Curry", amount: "200g", icon: "🍗" });
      } else if (name.includes("dal") || name.includes("lentil")) {
        ingredients.push({ name: "Dal Curry", amount: "200g", icon: "🟡" });
      } else if (name.includes("vegetable") || name.includes("veg")) {
        ingredients.push({
          name: "Vegetable Curry",
          amount: "200g",
          icon: "🥬",
        });
      } else {
        ingredients.push({ name: "Curry", amount: "200g", icon: "🥘" });
      }
      ingredients.push({ name: "Rice", amount: "150g", icon: "🍚" });
    } else if (name.includes("paratha")) {
      ingredients.push({ name: "Paratha", amount: "2 pieces", icon: "🫓" });
      if (name.includes("aloo")) {
        ingredients.push({
          name: "Potato Filling",
          amount: "100g",
          icon: "🥔",
        });
      }
      if (name.includes("paneer")) {
        ingredients.push({ name: "Paneer Filling", amount: "80g", icon: "🧀" });
      }
    } else if (name.includes("roti") || name.includes("chapati")) {
      ingredients.push({
        name: "Roti/Chapati",
        amount: "2-3 pieces",
        icon: "🫓",
      });
      if (name.includes("dal")) {
        ingredients.push({ name: "Dal", amount: "150ml", icon: "🟡" });
      }
      if (name.includes("sabzi") || name.includes("vegetable")) {
        ingredients.push({
          name: "Vegetable Sabzi",
          amount: "100g",
          icon: "🥬",
        });
      }
    }

    // Western dishes
    else if (name.includes("burger")) {
      ingredients.push({ name: "Burger Bun", amount: "1 piece", icon: "🍞" });
      if (name.includes("chicken")) {
        ingredients.push({ name: "Chicken Patty", amount: "120g", icon: "🍗" });
      } else if (name.includes("beef")) {
        ingredients.push({ name: "Beef Patty", amount: "120g", icon: "🥩" });
      } else if (name.includes("veg")) {
        ingredients.push({ name: "Veggie Patty", amount: "100g", icon: "🥬" });
      } else {
        ingredients.push({ name: "Patty", amount: "120g", icon: "🥩" });
      }
      ingredients.push({
        name: "Vegetables & Sauce",
        amount: "50g",
        icon: "🥗",
      });
    } else if (name.includes("pizza")) {
      ingredients.push({
        name: "Pizza Base",
        amount: "2-3 slices",
        icon: "🍕",
      });
      if (name.includes("cheese")) {
        ingredients.push({ name: "Cheese", amount: "60g", icon: "🧀" });
      }
      if (name.includes("chicken")) {
        ingredients.push({
          name: "Chicken Toppings",
          amount: "80g",
          icon: "🍗",
        });
      }
      if (name.includes("vegetable") || name.includes("veg")) {
        ingredients.push({
          name: "Vegetable Toppings",
          amount: "60g",
          icon: "🥬",
        });
      }
    } else if (name.includes("pasta")) {
      ingredients.push({ name: "Pasta", amount: "150g", icon: "🍝" });
      if (name.includes("chicken")) {
        ingredients.push({ name: "Chicken", amount: "100g", icon: "🍗" });
      }
      if (name.includes("sauce") || name.includes("tomato")) {
        ingredients.push({ name: "Pasta Sauce", amount: "80ml", icon: "🥫" });
      }
      if (name.includes("cheese")) {
        ingredients.push({ name: "Cheese", amount: "40g", icon: "🧀" });
      }
    } else if (name.includes("sandwich")) {
      ingredients.push({ name: "Bread", amount: "2 slices", icon: "🍞" });
      if (name.includes("chicken")) {
        ingredients.push({ name: "Chicken", amount: "100g", icon: "🍗" });
      } else if (name.includes("veg")) {
        ingredients.push({ name: "Vegetables", amount: "80g", icon: "🥬" });
      }
      if (name.includes("cheese")) {
        ingredients.push({ name: "Cheese", amount: "30g", icon: "🧀" });
      }
    }

    // Asian dishes
    else if (name.includes("noodles") || name.includes("chow mein")) {
      ingredients.push({ name: "Noodles", amount: "150g", icon: "🍜" });
      if (name.includes("chicken")) {
        ingredients.push({ name: "Chicken", amount: "100g", icon: "🍗" });
      }
      if (name.includes("vegetable") || name.includes("veg")) {
        ingredients.push({
          name: "Mixed Vegetables",
          amount: "80g",
          icon: "🥬",
        });
      }
    } else if (name.includes("fried rice")) {
      ingredients.push({ name: "Rice", amount: "200g", icon: "🍚" });
      if (name.includes("chicken")) {
        ingredients.push({ name: "Chicken", amount: "80g", icon: "🍗" });
      }
      if (name.includes("egg")) {
        ingredients.push({ name: "Egg", amount: "1 piece", icon: "🥚" });
      }
      ingredients.push({ name: "Mixed Vegetables", amount: "60g", icon: "🥬" });
    } else if (name.includes("sushi")) {
      ingredients.push({ name: "Sushi Rice", amount: "100g", icon: "🍚" });
      if (name.includes("salmon")) {
        ingredients.push({ name: "Salmon", amount: "50g", icon: "🐟" });
      } else if (name.includes("tuna")) {
        ingredients.push({ name: "Tuna", amount: "50g", icon: "🐟" });
      }
      ingredients.push({
        name: "Nori & Vegetables",
        amount: "20g",
        icon: "🥗",
      });
    }

    // Generic patterns - only if no specific dish found
    else if (name.includes("rice") && !ingredients.length) {
      ingredients.push({ name: "Rice", amount: "200g", icon: "🍚" });
      if (name.includes("chicken")) {
        ingredients.push({ name: "Chicken", amount: "120g", icon: "🍗" });
      }
    } else if (name.includes("chicken") && !ingredients.length) {
      ingredients.push({ name: "Chicken", amount: "150g", icon: "🍗" });
      if (name.includes("rice")) {
        ingredients.push({ name: "Rice", amount: "150g", icon: "🍚" });
      }
    } else if (name.includes("salad") && !ingredients.length) {
      ingredients.push({
        name: "Mixed Salad Greens",
        amount: "150g",
        icon: "🥬",
      });
      if (name.includes("chicken")) {
        ingredients.push({
          name: "Grilled Chicken",
          amount: "100g",
          icon: "🍗",
        });
      }
      ingredients.push({ name: "Salad Dressing", amount: "30ml", icon: "🥗" });
    } else if (name.includes("soup") && !ingredients.length) {
      ingredients.push({ name: "Soup", amount: "300ml", icon: "🥣" });
      if (name.includes("chicken")) {
        ingredients.push({ name: "Chicken Pieces", amount: "80g", icon: "🍗" });
      }
      if (name.includes("vegetable")) {
        ingredients.push({
          name: "Mixed Vegetables",
          amount: "60g",
          icon: "🥬",
        });
      }
    } else if (name.includes("juice") && !ingredients.length) {
      if (name.includes("orange")) {
        ingredients.push({ name: "Orange Juice", amount: "250ml", icon: "🍊" });
      } else if (name.includes("apple")) {
        ingredients.push({ name: "Apple Juice", amount: "250ml", icon: "🍎" });
      } else if (name.includes("mango")) {
        ingredients.push({ name: "Mango Juice", amount: "250ml", icon: "🥭" });
      } else {
        ingredients.push({ name: "Fruit Juice", amount: "250ml", icon: "🧃" });
      }
    }

    return ingredients;
  };

  // Initialize ingredients from analysis - use currentAnalysis if available, otherwise use analysis
  useEffect(() => {
    const initializeIngredients = () => {
      try {
        const analysisToUse = currentAnalysis || analysis;
        console.log("Analysis data:", analysisToUse);
        console.log("Analysis items:", analysisToUse?.items);

        // First, try to get ingredients from analysis
        if (
          analysisToUse?.items &&
          Array.isArray(analysisToUse.items) &&
          analysisToUse.items.length > 0
        ) {
          // Check if items are complete dishes (like "1 chicken sandwich") or ingredients
          const firstItem = analysisToUse.items[0];
          const firstItemName = (firstItem?.name || "").toLowerCase();
          const isCompleteDish =
            firstItemName &&
            (firstItemName.includes("sandwich") ||
              firstItemName.includes("burger") ||
              firstItemName.includes("pizza") ||
              firstItemName.includes("juice") ||
              firstItemName.includes("salad") ||
              firstItemName.includes("soup") ||
              firstItemName.includes("pasta") ||
              firstItemName.includes("rice") ||
              firstItemName.includes("biryani") ||
              firstItemName.includes("dosa") ||
              firstItemName.includes("idli") ||
              firstItemName.includes("curry") ||
              firstItemName.includes("paratha") ||
              firstItemName.includes("roti") ||
              firstItemName.includes("chapati") ||
              firstItemName.includes("noodles") ||
              firstItemName.includes("sushi") ||
              firstItemName.includes("fried rice"));

          if (isCompleteDish) {
            // If items are complete dishes, extract ingredients from meal name instead
            // Remove quantity prefixes like "1 ", "2 ", etc. from meal name for better matching
            const mealNameToUse = (
              mealNameState ||
              cleanFoodName ||
              analysisToUse?.dish_name ||
              "Meal"
            )
              .replace(/^\d+\s+/, "") // Remove leading number and space (e.g., "1 chicken biryani" -> "chicken biryani")
              .toLowerCase();
            const mainIngredients = extractMainIngredients(mealNameToUse);
            if (mainIngredients.length > 0) {
              const totalCalories = analysisToUse?.total?.calories || 0;
              const caloriesPerIngredient = Math.round(
                totalCalories / mainIngredients.length,
              );

              const newIngredients = mainIngredients.map(
                (ingredient, index) => ({
                  name: ingredient.name,
                  amount: ingredient.amount,
                  calories:
                    index === mainIngredients.length - 1
                      ? totalCalories -
                        caloriesPerIngredient * (mainIngredients.length - 1)
                      : caloriesPerIngredient,
                  icon: ingredient.icon,
                }),
              );
              setIngredients(newIngredients);
              return;
            }
          } else {
            // If items are actual ingredients, use them directly
            // The name field contains both quantity and name (e.g., "200g black beans")
            const newIngredients = analysisToUse.items.map((item) => ({
              name: item?.name || "Unknown Ingredient",
              amount: item?.name || "1 serving", // Use name as amount since quantity is in name
              calories: Math.round(item?.calories || 0),
              icon: getIngredientIcon(item?.name || ""),
            }));
            setIngredients(newIngredients);
            return;
          }
        }

        // If no analysis items, extract main ingredients from meal name
        // Remove quantity prefixes like "1 ", "2 ", etc. from meal name for better matching
        const mealNameToUse = (
          mealNameState ||
          cleanFoodName ||
          analysisToUse?.dish_name ||
          "Meal"
        )
          .replace(/^\d+\s+/, "") // Remove leading number and space (e.g., "1 chicken biryani" -> "chicken biryani")
          .toLowerCase();
        const totalCalories = analysisToUse?.total?.calories || 0;

        console.log("Meal name for ingredients:", mealNameToUse);
        console.log("Total calories:", totalCalories);

        // Extract main ingredients from meal name
        const mainIngredients = extractMainIngredients(mealNameToUse);
        console.log("Extracted main ingredients:", mainIngredients);

        if (mainIngredients.length > 0) {
          console.log("Using extracted main ingredients");
          // Distribute calories among main ingredients proportionally
          const caloriesPerIngredient = Math.round(
            totalCalories / mainIngredients.length,
          );

          const newIngredients = mainIngredients.map((ingredient, index) => ({
            name: ingredient.name,
            amount: ingredient.amount,
            calories:
              index === mainIngredients.length - 1
                ? totalCalories -
                  caloriesPerIngredient * (mainIngredients.length - 1)
                : caloriesPerIngredient,
            icon: ingredient.icon,
          }));
          setIngredients(newIngredients);
          return;
        }

        // Final fallback - only if no main ingredients could be extracted
        console.log("Using final fallback ingredient");
        setIngredients([
          {
            name: mealNameToUse || "Complete Meal",
            amount: "1 serving",
            calories: totalCalories,
            icon: "🍽️",
          },
        ]);
      } catch (error) {
        console.log("Error processing ingredients:", error);
        const analysisToUse = currentAnalysis || analysis;
        setIngredients([
          {
            name: "Complete Meal",
            amount: "1 serving",
            calories: analysisToUse?.total?.calories || 0,
            icon: "🍽️",
          },
        ]);
      }
    };

    initializeIngredients();
  }, [currentAnalysis, analysis, mealNameState, cleanFoodName]);

  // Block back navigation
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => true;
      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => backHandler.remove();
    }, []),
  );

  const handleMacroChange = (key, value) => {
    setMacros({ ...macros, [key]: value });
  };

  const handleIngredientChange = (index, field, value) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  const addIngredient = () => {
    setIngredients([
      ...ingredients,
      {
        name: "",
        amount: "",
        calories: 0,
        icon: "🍽️",
      },
    ]);
  };

  const removeIngredient = (index) => {
    const newIngredients = ingredients.filter((_, i) => i !== index);
    setIngredients(newIngredients);
  };

  const validateMealName = () => {
    if (!mealNameState || mealNameState.trim().length < 2) {
      setNameError("Meal name must be at least 2 characters");
      return false;
    }
    setNameError("");
    return true;
  };

  // Re-analyze food name using AI
  const handleReanalyzeFood = async () => {
    if (!mealNameState || mealNameState.trim().length < 2) {
      Alert.alert("Error", "Please enter a valid food name");
      return;
    }

    if (!genAI) {
      Alert.alert("Error", "AI service is not available");
      return;
    }

    setIsReanalyzing(true);
    try {
      const models = [
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
      ];
      let lastError = null;

      for (const modelName of models) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });

          const prompt = `Analyze the following meal text: "${mealNameState}". Your response MUST be a single valid JSON object and nothing else. Do not include markdown formatting like \`\`\`json.

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

          const result = await model.generateContent(prompt);
          const response = await result.response;
          let text = response.text();
          console.log(
            "VoicePostCalorieScreen - Re-analysis raw response:",
            text,
          );

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

            // Update analysis with new data
            const newAnalysis = {
              dish_name: mealNameState,
              items: data.items,
              total: {
                calories: data.total.calories,
                protein: data.total.protein,
                carbs: data.total.carbs,
                fat: data.total.fat,
                fiber: data.total.fiber || 0,
              },
            };

            setCurrentAnalysis(newAnalysis);

            // Update macros
            setMacros({
              protein: data.total.protein || 0,
              carbs: data.total.carbs || 0,
              fat: data.total.fat || 0,
              fiber: data.total.fiber || 0,
            });

            // Update ingredients will be handled by the useEffect that watches currentAnalysis
            setIsEditing(false);
            Alert.alert("Success", "Food re-analyzed successfully!");
            return;
          } else {
            throw new Error("Invalid JSON format from API.");
          }
        } catch (error) {
          lastError = error;
          console.log(`Model ${modelName} failed:`, error.message);
        }
      }

      throw lastError || new Error("All AI models are currently unavailable.");
    } catch (error) {
      console.error("VoicePostCalorieScreen - Re-analysis error:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to re-analyze food. Please try again.",
      );
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!validateMealName()) return;
    setSaving(true);
    try {
      console.log("Saving meal to saved_meal table...");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not logged in");
      const analysisToUse = currentAnalysis || analysis;
      const { calories } = analysisToUse?.total || {};
      const { protein, carbs, fat, fiber } = macros;
      const { description } = analysisToUse || {};

      const mealData = {
        user_id: user.id,
        dish_name: mealNameState,
        description: description || "",
        calories: Math.round(calories || 0),
        protein: Math.round(protein || 0),
        carbs: Math.round(carbs || 0),
        fat: Math.round(fat || 0),
        fiber: Math.round(fiber || 0),
        created_at: new Date().toISOString(),
      };

      console.log("Meal data to save:", mealData);
      const { error } = await supabase.from("saved_meal").insert([mealData]);
      if (error) {
        console.error("Error saving meal:", error);
        throw error;
      }
      console.log("Meal saved successfully!");

      // Invalidate SavedMealsScreen cache to force refresh
      try {
        const { globalSavedMealsCache } = require("./SavedMealsScreen");
        if (globalSavedMealsCache) {
          globalSavedMealsCache.cachedData = null;
          globalSavedMealsCache.lastFetchTime = 0;
        }
      } catch (cacheError) {
        console.log("Could not invalidate cache:", cacheError);
      }

      Alert.alert("Success", "Meal saved successfully!", [
        {
          text: "OK",
          onPress: () =>
            navigation.navigate("SavedMealsScreen", { refresh: true }),
        },
      ]);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDone = async () => {
    if (!validateMealName()) return;
    setLogging(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not logged in");
      const analysisToUse = currentAnalysis || analysis;
      const { calories } = analysisToUse?.total || {};
      const { protein, carbs, fat, fiber } = macros;
      const cleanFoodName = mealNameState.replace(/^You said:\s*/i, "");

      // Get selected mood emoji
      const selectedMoodEmoji =
        selectedMood !== null ? moodOptions[selectedMood].emoji : null;

      const logData = {
        user_id: user.id,
        food_name: cleanFoodName,
        serving_size: 1,
        calories: calories || 0,
        carbs: carbs || 0,
        protein: protein || 0,
        fat: fat || 0,
        fiber: fiber || 0,
        mood: selectedMoodEmoji,
        date_time: new Date().toISOString().split("T")[0],
        meal_type: "Quick Log",
        notes: "",
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("user_food_logs").insert([logData]);
      if (error) throw error;

      // Optimistic cache update (Instagram pattern)
      const {
        updateMainDashboardCacheOptimistic,
        updateHomeScreenCacheOptimistic,
        updateMainDashboardStreakOptimistic,
      } = require("../utils/cacheManager");
      updateMainDashboardCacheOptimistic(logData);
      updateHomeScreenCacheOptimistic(logData);
      updateMainDashboardStreakOptimistic(); // Trigger streak update

      Alert.alert("Success", "Food logged successfully!");
      navigation.replace("Home");
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLogging(false);
    }
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {/* Header */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.heroBackBtn}
          >
            <Ionicons name="chevron-back" size={22} color={palette.primary} />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Food Analysis</Text>
          <View style={styles.heroSpacer} />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingBottom: insets.bottom >= 20 ? insets.bottom + 20 : 20,
        }}
      >
        {/* Photo */}
        <View style={styles.photoContainer}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
            }}
            style={styles.photo}
            resizeMode="cover"
          />
        </View>

        {/* Food Name */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Identified Food</Text>
            <View style={styles.editActions}>
              {isEditing ? (
                <>
                  <TouchableOpacity
                    onPress={handleReanalyzeFood}
                    disabled={isReanalyzing}
                    style={styles.iconBtn}
                  >
                    {isReanalyzing ? (
                      <ActivityIndicator size="small" color={palette.primary} />
                    ) : (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={palette.primary}
                      />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIsEditing(false)}
                    style={styles.iconBtn}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={22}
                      color={palette.textSecondary}
                    />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  onPress={() => setIsEditing(true)}
                  style={styles.iconBtn}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={18}
                    color={palette.primary}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
          {isEditing ? (
            <TextInput
              style={[styles.foodName, styles.editableText]}
              value={mealNameState}
              onChangeText={setMealNameState}
              placeholder="Enter food name"
              placeholderTextColor={palette.textMuted}
              autoFocus
            />
          ) : (
            <Text style={styles.foodName}>
              {mealNameState ||
                currentAnalysis?.dish_name ||
                analysis?.dish_name ||
                "Meal"}
            </Text>
          )}
          <View style={styles.confidenceChip}>
            <Text style={styles.confidenceText}>Confidence: 85%</Text>
          </View>
        </View>

        {/* Nutrition Summary */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Nutrition Summary</Text>
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>
                {(currentAnalysis || analysis)?.total?.calories || 0}
              </Text>
              <Text style={styles.nutritionLabel}>Calories</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>
                {Math.round(macros.protein)}g
              </Text>
              <Text style={styles.nutritionLabel}>Protein</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>
                {Math.round(macros.carbs)}g
              </Text>
              <Text style={styles.nutritionLabel}>Carbs</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>
                {Math.round(macros.fat)}g
              </Text>
              <Text style={styles.nutritionLabel}>Fat</Text>
            </View>
          </View>
        </View>

        {/* Ingredients */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ingredients Detected</Text>
          <View style={styles.ingredientList}>
            {/* Use analysis.ingredients if available (from photo), otherwise use ingredients state (from voice) */}
            {analysis?.ingredients && analysis.ingredients.length > 0
              ? analysis.ingredients.map((ingredient, index) => (
                  <View
                    key={index}
                    style={[
                      styles.ingredientItem,
                      index !== 0 && styles.ingredientItemDivider,
                    ]}
                  >
                    <View style={styles.ingredientDot} />
                    <View style={styles.ingredientInfo}>
                      <Text style={styles.ingredientName}>
                        {ingredient.name}
                      </Text>
                      <Text style={styles.ingredientQuantity}>
                        {ingredient.quantity}
                      </Text>
                    </View>
                  </View>
                ))
              : ingredients.map((ingredient, index) => (
                  <View
                    key={index}
                    style={[
                      styles.ingredientItem,
                      index !== 0 && styles.ingredientItemDivider,
                    ]}
                  >
                    <View style={styles.ingredientDot} />
                    <View style={styles.ingredientInfo}>
                      <Text style={styles.ingredientName}>
                        {ingredient.name}
                      </Text>
                      <Text style={styles.ingredientQuantity}>
                        {ingredient.amount || "1 serving"}
                      </Text>
                    </View>
                  </View>
                ))}
          </View>
        </View>

        {/* Mood Selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How are you feeling?</Text>
          <View style={styles.moodGrid}>
            {moodOptions.map((mood, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.moodOption,
                  selectedMood === index && styles.selectedMood,
                ]}
                onPress={() =>
                  setSelectedMood(selectedMood === index ? null : index)
                }
                activeOpacity={0.85}
              >
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text
                  style={[
                    styles.moodLabel,
                    selectedMood === index && styles.moodLabelActive,
                  ]}
                >
                  {mood.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View
        style={[
          styles.actionContainer,
          { paddingBottom: insets.bottom >= 20 ? insets.bottom + 20 : 20 },
        ]}
      >
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Ionicons name="bookmark-outline" size={19} color={palette.primary} />
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Save Meal"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleDone}
          disabled={logging}
          activeOpacity={0.9}
        >
          <Text style={styles.confirmButtonText}>
            {logging ? "Logging..." : "Log Food"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (palette, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    content: {
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

    // Photo
    photoContainer: {
      marginTop: 12,
      marginBottom: 16,
      borderRadius: 24,
      overflow: "hidden",
    },
    photo: {
      width: "100%",
      height: 190,
    },

    // Generic card
    card: {
      backgroundColor: palette.card,
      borderRadius: 24,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 14,
      elevation: 3,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
      marginBottom: 10,
    },
    editActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: -10,
    },
    iconBtn: {
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    foodName: {
      fontSize: 17,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
      marginBottom: 8,
    },
    editableText: {
      borderBottomWidth: 1.5,
      borderBottomColor: palette.primary,
      paddingVertical: 4,
    },
    confidenceChip: {
      alignSelf: "flex-start",
      backgroundColor: palette.cardSecondary,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    confidenceText: {
      fontSize: 12,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
    },

    // Nutrition grid
    nutritionGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: palette.cardSecondary,
      borderRadius: 18,
      padding: 14,
    },
    nutritionItem: {
      alignItems: "center",
      flex: 1,
    },
    nutritionValue: {
      fontSize: 18,
      fontFamily: "Lexend-Bold",
      color: palette.primary,
    },
    nutritionLabel: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
      marginTop: 4,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },

    // Ingredients
    ingredientList: {
      backgroundColor: palette.cardSecondary,
      borderRadius: 16,
      paddingHorizontal: 14,
    },
    ingredientItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
    },
    ingredientItemDivider: {
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },
    ingredientDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: palette.primary,
      marginRight: 12,
    },
    ingredientInfo: {
      flex: 1,
    },
    ingredientName: {
      fontSize: 14,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
      marginBottom: 2,
    },
    ingredientQuantity: {
      fontSize: 12,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
    },

    // Mood grid
    moodGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 10,
    },
    moodOption: {
      width: "30%",
      alignItems: "center",
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: palette.cardSecondary,
      borderWidth: 1,
      borderColor: palette.border,
    },
    selectedMood: {
      backgroundColor: palette.selectedCard,
      borderColor: palette.primary,
    },
    moodEmoji: {
      fontSize: 24,
      marginBottom: 6,
    },
    moodLabel: {
      fontSize: 12,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
    },
    moodLabelActive: {
      color: palette.primary,
      fontFamily: "Lexend-SemiBold",
    },

    // Action buttons
    actionContainer: {
      flexDirection: "row",
      paddingHorizontal: 18,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: palette.border,
      backgroundColor: palette.background,
    },
    saveButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.cardSecondary,
      borderRadius: 18,
      paddingVertical: 15,
      marginRight: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    saveButtonText: {
      marginLeft: 6,
      fontSize: 15,
      fontFamily: "Lexend-SemiBold",
      color: palette.primary,
    },
    confirmButton: {
      flex: 1.4,
      backgroundColor: palette.primary,
      borderRadius: 18,
      paddingVertical: 15,
      alignItems: "center",
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.14,
      shadowRadius: 12,
      elevation: 4,
    },
    confirmButtonText: {
      fontSize: 15,
      fontFamily: "Lexend-SemiBold",
      color: "#FFFFFF",
    },
  });

export default VoicePostCalorieScreen;
