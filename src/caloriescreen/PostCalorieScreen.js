import { Ionicons } from "@expo/vector-icons";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
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
  console.error("PostCalorieScreen - No API key found!");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Shared palette — mirrors the teal design system used across the app
// (Home dashboard, Weight Tracker, Journal/Timeline, Daily Check-in,
// Deep Insights, Photo/Voice Food Analysis, Text to Calorie, Settings, etc.)
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

const PostCalorieScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const palette = useMemo(() => createPalette(isDark), [isDark]);
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const { analysis, mealName } = route.params || {};

  useEffect(() => {
    console.log("PostCalorieScreen - Theme state:", { isDark });
  }, [isDark]);

  if (!route.params) {
    console.log("No route params found, using defaults");
  }

  console.log("PostCalorieScreen - Route params:", route.params);
  console.log("PostCalorieScreen - Analysis:", analysis);
  console.log("PostCalorieScreen - Analysis total:", analysis?.total);
  console.log(
    "PostCalorieScreen - Analysis total_nutrition:",
    analysis?.total_nutrition,
  );

  const [macros, setMacros] = useState({
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [mealNameState, setMealNameState] = useState(
    analysis?.dish_name || mealName || "",
  );
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [logging, setLogging] = useState(false);
  const [selectedMood, setSelectedMood] = useState(null);
  const [macrosLoaded, setMacrosLoaded] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState(analysis);

  useEffect(() => {
    const analysisToUse = currentAnalysis || analysis;
    console.log("useEffect triggered with analysis:", analysisToUse);
    if (analysisToUse) {
      const newMacros = {
        protein:
          analysisToUse?.total?.protein ||
          analysisToUse?.total_nutrition?.protein ||
          0,
        carbs:
          analysisToUse?.total?.carbs ||
          analysisToUse?.total_nutrition?.carbs ||
          0,
        fat:
          analysisToUse?.total?.fat || analysisToUse?.total_nutrition?.fat || 0,
        fiber:
          analysisToUse?.total?.fiber ||
          analysisToUse?.total_nutrition?.fiber ||
          0,
      };
      console.log("Updating macros with:", newMacros);
      console.log("Fiber value specifically:", newMacros.fiber);
      setMacros(newMacros);
      setMacrosLoaded(true);
    } else {
      console.log("No analysis data available");
      setMacrosLoaded(true);
    }
  }, [currentAnalysis, analysis]);

  useEffect(() => {
    console.log("Macros state changed to:", macros);
    console.log("Current fiber value:", macros.fiber);
  }, [macros]);

  const calculateHealthScore = () => {
    const analysisToUse = currentAnalysis || analysis;
    const { calories, protein, carbs, fat, fiber } =
      analysisToUse?.total || analysisToUse?.total_nutrition || {};

    if (!calories || calories === 0) {
      return {
        score: 0,
        text: "No Data",
        info: "No nutritional data available",
      };
    }

    let score = 0;

    const proteinCalories = protein * 4;
    const proteinPercentage = (proteinCalories / calories) * 100;
    if (proteinPercentage >= 20 && proteinPercentage <= 30) score += 3;
    else if (proteinPercentage >= 15 && proteinPercentage <= 35) score += 2;
    else if (proteinPercentage >= 10 && proteinPercentage <= 40) score += 1;
    else if (proteinPercentage < 10) score -= 1;

    const carbCalories = carbs * 4;
    const carbPercentage = (carbCalories / calories) * 100;
    if (carbPercentage >= 45 && carbPercentage <= 65) score += 2.5;
    else if (carbPercentage >= 35 && carbPercentage <= 75) score += 1.5;
    else if (carbPercentage >= 25 && carbPercentage <= 85) score += 0.5;
    else if (carbPercentage > 85) score -= 1;

    const fatCalories = fat * 9;
    const fatPercentage = (fatCalories / calories) * 100;
    if (fatPercentage >= 20 && fatPercentage <= 35) score += 2;
    else if (fatPercentage >= 15 && fatPercentage <= 40) score += 1;
    else if (fatPercentage >= 10 && fatPercentage <= 45) score += 0.5;
    else if (fatPercentage > 45) score -= 1;
    else if (fatPercentage < 10) score -= 0.5;

    if (fiber >= 10) score += 1.5;
    else if (fiber >= 7) score += 1;
    else if (fiber >= 5) score += 0.5;
    else if (fiber >= 3) score += 0;
    else score -= 0.5;

    if (calories >= 400 && calories <= 800) score += 1;
    else if (calories >= 300 && calories <= 1000) score += 0.5;
    else if (calories < 200 || calories > 1200) score -= 1;

    score = Math.max(0, Math.min(10, score));

    let healthText = "Poor";
    if (score >= 8) healthText = "Excellent";
    else if (score >= 6) healthText = "Good";
    else if (score >= 4) healthText = "Balanced";
    else if (score >= 2) healthText = "Fair";

    let infoText = "";

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
    return "🍽️";
  };

  const extractMainIngredients = (mealName) => {
    console.log("extractMainIngredients called with:", mealName);
    const name = mealName.toLowerCase();
    console.log("Lowercase meal name:", name);
    const ingredients = [];

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
    } else if (name.includes("burger")) {
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
    } else if (name.includes("noodles") || name.includes("chow mein")) {
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
    } else if (name.includes("rice") && !ingredients.length) {
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

  useEffect(() => {
    const initializeIngredients = () => {
      try {
        const analysisToUse = currentAnalysis || analysis;
        console.log("Analysis data:", analysisToUse);
        console.log("Analysis items:", analysisToUse?.items);

        if (
          analysisToUse?.items &&
          Array.isArray(analysisToUse.items) &&
          analysisToUse.items.length > 0
        ) {
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
            const mealNameToUse = (
              mealNameState ||
              analysisToUse?.dish_name ||
              "Meal"
            )
              .replace(/^\d+\s+/, "")
              .toLowerCase();
            const mainIngredients = extractMainIngredients(mealNameToUse);
            if (mainIngredients.length > 0) {
              const totalCalories =
                analysisToUse?.total?.calories ||
                analysisToUse?.total_nutrition?.calories ||
                0;
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
            const newIngredients = analysisToUse.items.map((item) => ({
              name: item?.name || "Unknown Ingredient",
              amount: item?.name || "1 serving",
              calories: Math.round(item?.calories || 0),
              icon: getIngredientIcon(item?.name || ""),
            }));
            setIngredients(newIngredients);
            return;
          }
        }

        const mealNameToUse = (
          mealNameState ||
          analysisToUse?.dish_name ||
          "Meal"
        )
          .replace(/^\d+\s+/, "")
          .toLowerCase();
        const totalCalories =
          analysisToUse?.total?.calories ||
          analysisToUse?.total_nutrition?.calories ||
          0;

        console.log("Meal name for ingredients:", mealNameToUse);
        console.log("Total calories:", totalCalories);

        const mainIngredients = extractMainIngredients(mealNameToUse);
        console.log("Extracted main ingredients:", mainIngredients);

        if (mainIngredients.length > 0) {
          console.log("Using extracted main ingredients");
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
            calories:
              analysisToUse?.total?.calories ||
              analysisToUse?.total_nutrition?.calories ||
              0,
            icon: "🍽️",
          },
        ]);
      }
    };

    initializeIngredients();
  }, [currentAnalysis, analysis, mealNameState]);

  const moodOptions = [
    { emoji: "😀", label: "Happy" },
    { emoji: "😊", label: "Content" },
    { emoji: "😐", label: "Neutral" },
    { emoji: "😞", label: "Sad" },
    { emoji: "😴", label: "Tired" },
    { emoji: "😤", label: "Stressed" },
  ];

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
          console.log("PostCalorieScreen - Re-analysis raw response:", text);

          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jsonString = jsonMatch[0];
            const data = JSON.parse(jsonString);

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

            setMacros({
              protein: data.total.protein || 0,
              carbs: data.total.carbs || 0,
              fat: data.total.fat || 0,
              fiber: data.total.fiber || 0,
            });

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
      console.error("PostCalorieScreen - Re-analysis error:", error);
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not logged in");
      const analysisToUse = currentAnalysis || analysis;
      const { calories } =
        analysisToUse?.total || analysisToUse?.total_nutrition || {};
      const { protein, carbs, fat, fiber } = macros;
      const { description } = analysisToUse || {};

      let photoUrl = null;
      if (route?.params?.photoUri) {
        try {
          const fileName = `food-photos/${user.id}/${Date.now()}.jpg`;
          const { data: { session } } = await supabase.auth.getSession();
          const authToken = session?.access_token;
          const supabaseUrl = 'https://tkuyjtdycmmkvunurlxj.supabase.co';
          const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrdXlqdGR5Y21ta3Z1bnVybHhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzIwMDYsImV4cCI6MjA4OTQwODAwNn0.Vs1fjhWuGK93s2vbe3mcj-nLQaCcKXGVQW3LjnpD2VY';

          if (authToken) {
            const uploadResult = await FileSystem.uploadAsync(
              `${supabaseUrl}/storage/v1/object/food-photos/${fileName}`,
              route.params.photoUri,
              {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'apikey': supabaseAnonKey,
                  'Content-Type': 'image/jpeg',
                  'x-upsert': 'false',
                },
              }
            );

            if (uploadResult.status >= 200 && uploadResult.status < 300) {
              photoUrl = fileName;
              console.log('PostCalorieScreen photo uploaded successfully:', fileName);
            } else {
              console.error('PostCalorieScreen upload failed status:', uploadResult.status, uploadResult.body);
            }
          }
        } catch (uploadError) {
          console.error("Error uploading photo:", uploadError);
        }
      }

      const { error } = await supabase.from("saved_meal").insert([
        {
          user_id: user.id,
          dish_name: mealNameState,
          description: description || "",
          calories: Math.round(calories || 0),
          protein: Math.round(protein || 0),
          carbs: Math.round(carbs || 0),
          fat: Math.round(fat || 0),
          fiber: Math.round(fiber || 0),
          photo_url: photoUrl,
        },
      ]);
      if (error) throw error;

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
      const { calories } =
        analysisToUse?.total || analysisToUse?.total_nutrition || {};
      const { protein, carbs, fat, fiber } = macros;
      const cleanFoodName = mealNameState.replace(/^You said:\s*/i, "");

      const selectedMoodEmoji =
        selectedMood !== null ? moodOptions[selectedMood].emoji : null;

      let photoUrl = null;
      if (route?.params?.photoUri) {
        try {
          const fileName = `food-photos/${user.id}/${Date.now()}.jpg`;
          const { data: { session } } = await supabase.auth.getSession();
          const authToken = session?.access_token;
          const supabaseUrl = 'https://tkuyjtdycmmkvunurlxj.supabase.co';
          const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrdXlqdGR5Y21ta3Z1bnVybHhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzIwMDYsImV4cCI6MjA4OTQwODAwNn0.Vs1fjhWuGK93s2vbe3mcj-nLQaCcKXGVQW3LjnpD2VY';

          if (authToken) {
            const uploadResult = await FileSystem.uploadAsync(
              `${supabaseUrl}/storage/v1/object/food-photos/${fileName}`,
              route.params.photoUri,
              {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'apikey': supabaseAnonKey,
                  'Content-Type': 'image/jpeg',
                  'x-upsert': 'false',
                },
              }
            );

            if (uploadResult.status >= 200 && uploadResult.status < 300) {
              photoUrl = fileName;
              console.log('PostCalorieScreen photo uploaded successfully:', fileName);
            } else {
              console.error('PostCalorieScreen upload failed status:', uploadResult.status, uploadResult.body);
            }
          }
        } catch (uploadError) {
          console.error("Error uploading photo:", uploadError);
        }
      }

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
        photo_url: photoUrl,
        date_time: new Date().toISOString().split("T")[0],
        meal_type: "Quick Log",
        notes: "",
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("user_food_logs").insert([logData]);
      if (error) throw error;

      const {
        updateMainDashboardCacheOptimistic,
        updateHomeScreenCacheOptimistic,
        updateMainDashboardStreakOptimistic,
      } = require("../utils/cacheManager");
      updateMainDashboardCacheOptimistic(logData);
      updateHomeScreenCacheOptimistic(logData);
      updateMainDashboardStreakOptimistic();

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

  const analysisToUse = currentAnalysis || analysis;
  const totalCalories =
    analysisToUse?.total?.calories ||
    analysisToUse?.total_nutrition?.calories ||
    0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Hero header — matches Photo/Voice Food Analysis screens */}
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
              uri:
                route?.params?.photoUri ||
                "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
            }}
            style={styles.photo}
            resizeMode="cover"
          />
          <View style={styles.calorieBadge}>
            <Text style={styles.calorieBadgeValue}>{totalCalories}</Text>
            <Text style={styles.calorieBadgeLabel}>kcal</Text>
          </View>
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
            <>
              <TextInput
                style={[styles.foodName, styles.editableText]}
                value={mealNameState}
                onChangeText={setMealNameState}
                placeholder="Enter food name"
                placeholderTextColor={palette.textMuted}
                autoFocus
              />
              {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}
            </>
          ) : (
            <Text style={styles.foodName}>
              {mealNameState || analysisToUse?.dish_name || "Meal"}
            </Text>
          )}
          <View style={styles.confidenceChip}>
            <Text style={styles.confidenceText}>
              Confidence 85% • Quick log ready
            </Text>
          </View>
        </View>

        {/* Health score */}
        <View style={styles.healthCard}>
          <View style={styles.healthRing}>
            <Text style={styles.healthRingValue}>{healthScore}</Text>
          </View>
          <View style={styles.healthTextWrap}>
            <Text style={styles.healthTitle}>{healthText}</Text>
            <Text style={styles.healthDesc} numberOfLines={3}>
              {infoText}
            </Text>
          </View>
        </View>

        {/* Nutrition Summary */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Nutrition Summary</Text>
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{totalCalories}</Text>
              <Text style={styles.nutritionLabel}>Calories</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{Math.round(macros.protein)}g</Text>
              <Text style={styles.nutritionLabel}>Protein</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{Math.round(macros.carbs)}g</Text>
              <Text style={styles.nutritionLabel}>Carbs</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{Math.round(macros.fat)}g</Text>
              <Text style={styles.nutritionLabel}>Fat</Text>
            </View>
          </View>
          <View style={styles.fiberChip}>
            <Text style={styles.fiberChipLabel}>Fiber</Text>
            <Text style={styles.fiberChipValue}>{Math.round(macros.fiber)}g</Text>
          </View>
        </View>

        {/* Ingredients */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ingredients Detected</Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{ingredients.length}</Text>
            </View>
          </View>
          <View style={styles.ingredientList}>
            {ingredients.map((ingredient, index) => (
              <View
                key={index}
                style={[styles.ingredientItem, index !== 0 && styles.ingredientItemDivider]}
              >
                <View style={styles.ingredientIconShell}>
                  <Text style={styles.ingredientEmoji}>{ingredient.icon || "🍽️"}</Text>
                </View>
                <View style={styles.ingredientInfo}>
                  <Text style={styles.ingredientName}>{ingredient.name}</Text>
                  <Text style={styles.ingredientQuantity}>{ingredient.amount}</Text>
                </View>
                <View style={styles.ingredientCaloriesWrap}>
                  <Text style={styles.ingredientCalories}>{ingredient.calories || 0}</Text>
                  <Text style={styles.ingredientCaloriesLabel}>kcal</Text>
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
                style={[styles.moodOption, selectedMood === index && styles.selectedMood]}
                onPress={() => setSelectedMood(selectedMood === index ? null : index)}
                activeOpacity={0.85}
              >
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={[styles.moodLabel, selectedMood === index && styles.moodLabelActive]}>
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
          <Ionicons
            name={saving ? "time-outline" : "bookmark-outline"}
            size={19}
            color={palette.primary}
          />
          <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Meal"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleDone}
          disabled={logging}
          activeOpacity={0.9}
        >
          {logging ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmButtonText}>Log Food</Text>
          )}
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
      position: "relative",
      marginTop: 12,
      marginBottom: 16,
      borderRadius: 24,
      overflow: "hidden",
    },
    photo: {
      width: "100%",
      height: 200,
    },
    calorieBadge: {
      position: "absolute",
      right: 14,
      bottom: 14,
      width: 68,
      height: 68,
      borderRadius: 22,
      backgroundColor: isDark ? "rgba(23,48,45,0.92)" : "rgba(255,255,255,0.94)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    calorieBadgeValue: {
      fontSize: 18,
      fontFamily: "Lexend-Bold",
      color: palette.primary,
      lineHeight: 20,
    },
    calorieBadgeLabel: {
      fontSize: 10,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
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
    errorText: {
      fontSize: 12,
      fontFamily: "Manrope-SemiBold",
      color: palette.destructive,
      marginBottom: 8,
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

    // Health score card
    healthCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.primary,
      borderRadius: 24,
      padding: 18,
      marginBottom: 16,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
      elevation: 6,
    },
    healthRing: {
      width: 60,
      height: 60,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.16)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.24)",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
    },
    healthRingValue: {
      fontSize: 20,
      fontFamily: "Lexend-Bold",
      color: "#FFFFFF",
    },
    healthTextWrap: {
      flex: 1,
    },
    healthTitle: {
      fontSize: 16,
      fontFamily: "Lexend-Bold",
      color: "#FFFFFF",
      marginBottom: 3,
    },
    healthDesc: {
      fontSize: 12.5,
      fontFamily: "Manrope-Regular",
      color: "rgba(244, 251, 250, 0.85)",
      lineHeight: 18,
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
    fiberChip: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: palette.cardSecondary,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 10,
    },
    fiberChipLabel: {
      fontSize: 12,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
    },
    fiberChipValue: {
      fontSize: 14,
      fontFamily: "Lexend-Bold",
      color: palette.primary,
    },

    // Ingredients
    countPill: {
      width: 26,
      height: 26,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.primary,
      marginBottom: -10,
    },
    countPillText: {
      fontSize: 12,
      fontFamily: "Lexend-Bold",
      color: "#FFFFFF",
    },
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
    ingredientIconShell: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    ingredientEmoji: {
      fontSize: 16,
    },
    ingredientInfo: {
      flex: 1,
      paddingRight: 8,
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
    ingredientCaloriesWrap: {
      alignItems: "flex-end",
    },
    ingredientCalories: {
      fontSize: 14,
      fontFamily: "Lexend-Bold",
      color: palette.primary,
    },
    ingredientCaloriesLabel: {
      fontSize: 10,
      fontFamily: "Manrope-SemiBold",
      color: palette.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
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
      justifyContent: "center",
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

export default PostCalorieScreen;