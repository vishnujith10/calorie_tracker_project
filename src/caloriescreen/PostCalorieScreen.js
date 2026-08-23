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
  console.error("PostCalorieScreen - No API key found!");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const PostCalorieScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { analysis, mealName } = route.params || {};

  useEffect(() => {
    console.log("PostCalorieScreen - Theme state:", {
      isDark,
      background: colors.background,
      cardBackground: colors.cardBackground,
    });
  }, [isDark, colors]);

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
        "gemini-flash-latest",
        "gemini-1.5-flash",
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

          const response = await fetch(route.params.photoUri);
          const arrayBuffer = await response.arrayBuffer();

          const { error } = await supabase.storage
            .from("food-photos")
            .upload(fileName, arrayBuffer, {
              contentType: "image/jpeg",
            });

          if (error) {
            console.error("Error uploading photo:", error);
          } else {
            photoUrl = fileName;
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

          const response = await fetch(route.params.photoUri);
          const arrayBuffer = await response.arrayBuffer();

          const { error } = await supabase.storage
            .from("food-photos")
            .upload(fileName, arrayBuffer, {
              contentType: "image/jpeg",
            });

          if (error) {
            console.error("Error uploading photo:", error);
          } else {
            photoUrl = fileName;
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

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
        >
          <Ionicons name="chevron-back" size={22} color={styles.$iconColor} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerEyebrow}>Meal review</Text>
          <Text style={styles.headerTitle}>Food Analysis</Text>
        </View>

        <View style={styles.iconButtonGhost}>
          <Ionicons
            name="sparkles-outline"
            size={18}
            color={styles.$iconMuted}
          />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom >= 20 ? insets.bottom + 120 : 120,
        }}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroLabelPill}>
              <Ionicons
                name="scan-outline"
                size={14}
                color={styles.$pillIcon}
              />
              <Text style={styles.heroLabelText}>Analyzed result</Text>
            </View>
            <Text style={styles.heroTimeText}>{getCurrentTime()}</Text>
          </View>

          <View style={styles.photoShell}>
            <Image
              source={{
                uri:
                  route?.params?.photoUri ||
                  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
              }}
              style={styles.photo}
              resizeMode="cover"
            />
            <View style={styles.photoOverlay} />
            <View style={styles.heroCalorieBadge}>
              <Text style={styles.heroCalorieValue}>{totalCalories}</Text>
              <Text style={styles.heroCalorieLabel}>kcal</Text>
            </View>
          </View>

          <View style={styles.heroTextBlock}>
            <Text style={styles.heroTitle}>Today’s detected meal</Text>

            <View style={styles.heroEditRow}>
              {isEditing ? (
                <View style={styles.editInputWrap}>
                  <TextInput
                    style={[
                      styles.foodNameInput,
                      nameError ? styles.inputError : null,
                    ]}
                    value={mealNameState}
                    onChangeText={setMealNameState}
                    placeholder="Enter food name"
                    placeholderTextColor={styles.$placeholderColor}
                    autoFocus
                  />
                  <View style={styles.inlineActions}>
                    <TouchableOpacity
                      onPress={handleReanalyzeFood}
                      disabled={isReanalyzing}
                      style={styles.inlineActionPrimary}
                    >
                      {isReanalyzing ? (
                        <ActivityIndicator
                          size="small"
                          color={styles.$buttonTextOnDark}
                        />
                      ) : (
                        <Ionicons
                          name="sparkles"
                          size={16}
                          color={styles.$buttonTextOnDark}
                        />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setIsEditing(false)}
                      style={styles.inlineActionSecondary}
                    >
                      <Ionicons
                        name="close"
                        size={16}
                        color={styles.$iconColor}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.heroNameRow}>
                  <Text style={styles.foodNameDisplay}>
                    {mealNameState || analysisToUse?.dish_name || "Meal"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setIsEditing(true)}
                    style={styles.editFab}
                  >
                    <Ionicons
                      name="pencil-outline"
                      size={16}
                      color={styles.$iconColor}
                    />
                  </TouchableOpacity>
                </View>
              )}

              {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}
            </View>

            <Text style={styles.heroSubText}>
              Confidence 85% • Quick log ready
            </Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.healthPanel}>
            <View style={styles.healthRing}>
              <Text style={styles.healthRingValue}>{healthScore}</Text>
            </View>
            <View style={styles.healthPanelText}>
              <Text style={styles.healthPanelTitle}>{healthText}</Text>
              <Text style={styles.healthPanelDesc} numberOfLines={3}>
                {infoText}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCardLarge}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.sectionKicker}>Nutrition</Text>
              <Text style={styles.sectionTitle}>Macro snapshot</Text>
            </View>
            <View style={styles.summaryChip}>
              <Text style={styles.summaryChipText}>
                {macrosLoaded ? "Ready" : "Loading"}
              </Text>
            </View>
          </View>

          <View style={styles.nutritionGrid}>
            <View style={[styles.statTile, styles.statTilePrimary]}>
              <Text style={styles.statTileValue}>{totalCalories}</Text>
              <Text style={styles.statTileLabel}>Calories</Text>
            </View>

            <View style={styles.statTile}>
              <Text style={styles.statTileValue}>
                {Math.round(macros.protein)}g
              </Text>
              <Text style={styles.statTileLabel}>Protein</Text>
            </View>

            <View style={styles.statTile}>
              <Text style={styles.statTileValue}>
                {Math.round(macros.carbs)}g
              </Text>
              <Text style={styles.statTileLabel}>Carbs</Text>
            </View>

            <View style={styles.statTile}>
              <Text style={styles.statTileValue}>
                {Math.round(macros.fat)}g
              </Text>
              <Text style={styles.statTileLabel}>Fat</Text>
            </View>

            <View style={[styles.statTile, styles.statTileWide]}>
              <Text style={styles.statTileValue}>
                {Math.round(macros.fiber)}g
              </Text>
              <Text style={styles.statTileLabel}>Fiber</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.sectionKicker}>Breakdown</Text>
              <Text style={styles.sectionTitle}>Ingredients detected</Text>
            </View>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{ingredients.length}</Text>
            </View>
          </View>

          <View style={styles.ingredientsList}>
            {ingredients.map((ingredient, index) => (
              <View key={index} style={styles.ingredientRowCard}>
                <View style={styles.ingredientMarker}>
                  <Text style={styles.ingredientEmoji}>
                    {ingredient.icon || "🍽️"}
                  </Text>
                </View>

                <View style={styles.ingredientBody}>
                  <Text style={styles.ingredientNameText}>
                    {ingredient.name}
                  </Text>
                  <Text style={styles.ingredientQuantity}>
                    {ingredient.amount}
                  </Text>
                </View>

                <View style={styles.ingredientMeta}>
                  <Text style={styles.ingredientCalories}>
                    {ingredient.calories || 0}
                  </Text>
                  <Text style={styles.ingredientCaloriesLabel}>kcal</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.sectionKicker}>Check-in</Text>
              <Text style={styles.sectionTitle}>How are you feeling?</Text>
            </View>
          </View>

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
              >
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={styles.moodLabel}>{mood.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.actionBar,
          { paddingBottom: insets.bottom >= 20 ? insets.bottom + 16 : 18 },
        ]}
      >
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons
            name={saving ? "time-outline" : "bookmark-outline"}
            size={18}
            color={styles.$saveIcon}
          />
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Save"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleDone}
          disabled={logging}
        >
          {logging ? (
            <ActivityIndicator size="small" color={styles.$buttonTextOnDark} />
          ) : (
            <>
              <Text style={styles.confirmButtonText}>Log Food</Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={styles.$buttonTextOnDark}
              />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors, isDark) => {
  const palette = {
    primary: "#1F4E4A",
    primarySoft: "#2A625C",
    mint: "#A8D5CE",
    bg: "#F4FBFA",
    surface: "#FFFFFF",
    surfaceSoft: "#EEF7F5",
    border: "#D6E8E3",
    text: "#173A37",
    textSoft: "#5E7A76",
    textFaint: "#86A5A0",
    darkSurface: "#173A37",
    darkTextOnPrimary: "#F4FBFA",
    successTint: "#DDEFEA",
    shadow: "rgba(31, 78, 74, 0.12)",
  };

  const adaptiveBg = isDark ? "#0F2624" : palette.bg;
  const adaptiveSurface = isDark ? "#16312F" : palette.surface;
  const adaptiveSurfaceSoft = isDark ? "#1C3B38" : palette.surfaceSoft;
  const adaptiveText = isDark ? "#EAF7F4" : palette.text;
  const adaptiveTextSoft = isDark ? "#A9C4BF" : palette.textSoft;
  const adaptiveBorder = isDark ? "rgba(168, 213, 206, 0.16)" : palette.border;
  const adaptivePrimary = palette.primary;
  const adaptivePrimarySoft = isDark ? "#285954" : palette.primarySoft;
  const adaptiveMint = isDark ? "#7FB9AF" : palette.mint;

  return StyleSheet.create({
    $iconColor: adaptiveText,
    $iconMuted: adaptiveTextSoft,
    $pillIcon: adaptivePrimary,
    $placeholderColor: adaptiveTextSoft,
    $buttonTextOnDark: palette.darkTextOnPrimary,
    $saveIcon: adaptivePrimary,

    container: {
      flex: 1,
      backgroundColor: adaptiveBg,
    },

    content: {
      flex: 1,
      backgroundColor: adaptiveBg,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
      backgroundColor: adaptiveBg,
    },

    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: adaptiveSurface,
      borderWidth: 1,
      borderColor: adaptiveBorder,
    },

    iconButtonGhost: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: adaptiveSurfaceSoft,
      borderWidth: 1,
      borderColor: adaptiveBorder,
    },

    headerCenter: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 12,
    },

    headerEyebrow: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: adaptiveTextSoft,
      marginBottom: 3,
    },

    headerTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: adaptiveText,
    },

    heroCard: {
      marginHorizontal: 18,
      marginTop: 6,
      marginBottom: 18,
      backgroundColor: adaptiveSurface,
      borderRadius: 28,
      padding: 16,
      borderWidth: 1,
      borderColor: adaptiveBorder,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.16 : 0.08,
      shadowRadius: 22,
      elevation: 8,
    },

    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },

    heroLabelPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: adaptiveSurfaceSoft,
      borderWidth: 1,
      borderColor: adaptiveBorder,
    },

    heroLabelText: {
      fontSize: 12,
      fontWeight: "700",
      color: adaptivePrimary,
    },

    heroTimeText: {
      fontSize: 12,
      fontWeight: "600",
      color: adaptiveTextSoft,
    },

    photoShell: {
      position: "relative",
      borderRadius: 24,
      overflow: "hidden",
      marginBottom: 16,
      backgroundColor: adaptiveSurfaceSoft,
    },

    photo: {
      width: "100%",
      height: 220,
    },

    photoOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(31, 78, 74, 0.08)",
    },

    heroCalorieBadge: {
      position: "absolute",
      right: 14,
      bottom: 14,
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: "rgba(244, 251, 250, 0.92)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(31, 78, 74, 0.12)",
    },

    heroCalorieValue: {
      fontSize: 22,
      fontWeight: "800",
      color: adaptivePrimary,
      lineHeight: 24,
    },

    heroCalorieLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: adaptiveTextSoft,
      marginTop: 2,
      textTransform: "uppercase",
      letterSpacing: 0.7,
    },

    heroTextBlock: {
      paddingHorizontal: 4,
    },

    heroTitle: {
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      color: adaptiveTextSoft,
      marginBottom: 10,
    },

    heroEditRow: {
      marginBottom: 8,
    },

    heroNameRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },

    foodNameDisplay: {
      flex: 1,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: "800",
      color: adaptiveText,
    },

    editFab: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: adaptiveSurfaceSoft,
      borderWidth: 1,
      borderColor: adaptiveBorder,
    },

    editInputWrap: {
      gap: 10,
    },

    foodNameInput: {
      fontSize: 24,
      fontWeight: "800",
      color: adaptiveText,
      backgroundColor: adaptiveSurfaceSoft,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: adaptiveBorder,
    },

    inputError: {
      borderColor: "#C95E5E",
    },

    inlineActions: {
      flexDirection: "row",
      gap: 10,
    },

    inlineActionPrimary: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: adaptivePrimary,
    },

    inlineActionSecondary: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: adaptiveSurfaceSoft,
      borderWidth: 1,
      borderColor: adaptiveBorder,
    },

    errorText: {
      marginTop: 8,
      fontSize: 12,
      color: "#C95E5E",
      fontWeight: "600",
    },

    heroSubText: {
      fontSize: 14,
      color: adaptiveTextSoft,
      fontWeight: "600",
    },

    metricsRow: {
      marginHorizontal: 18,
      marginBottom: 18,
    },

    healthPanel: {
      backgroundColor: adaptivePrimary,
      borderRadius: 26,
      padding: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      shadowColor: palette.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 20,
      elevation: 10,
    },

    healthRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: "rgba(244, 251, 250, 0.16)",
      borderWidth: 1,
      borderColor: "rgba(244, 251, 250, 0.22)",
      alignItems: "center",
      justifyContent: "center",
    },

    healthRingValue: {
      fontSize: 24,
      fontWeight: "800",
      color: palette.darkTextOnPrimary,
    },

    healthPanelText: {
      flex: 1,
    },

    healthPanelTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: palette.darkTextOnPrimary,
      marginBottom: 4,
    },

    healthPanelDesc: {
      fontSize: 13,
      lineHeight: 19,
      color: "rgba(244, 251, 250, 0.86)",
    },

    sectionCardLarge: {
      marginHorizontal: 18,
      marginBottom: 18,
      backgroundColor: adaptiveSurface,
      borderRadius: 26,
      padding: 18,
      borderWidth: 1,
      borderColor: adaptiveBorder,
    },

    sectionCard: {
      marginHorizontal: 18,
      marginBottom: 18,
      backgroundColor: adaptiveSurface,
      borderRadius: 26,
      padding: 18,
      borderWidth: 1,
      borderColor: adaptiveBorder,
    },

    sectionHeadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
      gap: 12,
    },

    sectionKicker: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: adaptiveTextSoft,
      marginBottom: 4,
    },

    sectionTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: adaptiveText,
    },

    summaryChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: adaptiveSurfaceSoft,
      borderWidth: 1,
      borderColor: adaptiveBorder,
    },

    summaryChipText: {
      fontSize: 12,
      fontWeight: "700",
      color: adaptivePrimary,
    },

    nutritionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 12,
    },

    statTile: {
      width: "47%",
      backgroundColor: adaptiveSurfaceSoft,
      borderRadius: 22,
      paddingVertical: 18,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: adaptiveBorder,
    },

    statTilePrimary: {
      backgroundColor: adaptivePrimary,
      borderColor: adaptivePrimary,
    },

    statTileWide: {
      width: "100%",
      backgroundColor: isDark ? adaptivePrimarySoft : palette.successTint,
    },

    statTileValue: {
      fontSize: 24,
      fontWeight: "800",
      color: adaptiveText,
      marginBottom: 6,
    },

    statTileLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: adaptiveTextSoft,
    },

    ingredientsList: {
      gap: 12,
    },

    ingredientRowCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: adaptiveSurfaceSoft,
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: adaptiveBorder,
    },

    ingredientMarker: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: adaptiveSurface,
      marginRight: 12,
      borderWidth: 1,
      borderColor: adaptiveBorder,
    },

    ingredientEmoji: {
      fontSize: 22,
    },

    ingredientBody: {
      flex: 1,
    },

    ingredientNameText: {
      fontSize: 16,
      fontWeight: "700",
      color: adaptiveText,
      marginBottom: 3,
    },

    ingredientQuantity: {
      fontSize: 13,
      fontWeight: "600",
      color: adaptiveTextSoft,
    },

    ingredientMeta: {
      alignItems: "flex-end",
      marginLeft: 10,
    },

    ingredientCalories: {
      fontSize: 16,
      fontWeight: "800",
      color: adaptivePrimary,
    },

    ingredientCaloriesLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: adaptiveTextSoft,
      textTransform: "uppercase",
      letterSpacing: 0.7,
    },

    countPill: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: adaptivePrimary,
    },

    countPillText: {
      fontSize: 13,
      fontWeight: "800",
      color: palette.darkTextOnPrimary,
    },

    moodGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },

    moodOption: {
      width: "31%",
      backgroundColor: adaptiveSurfaceSoft,
      borderRadius: 22,
      alignItems: "center",
      paddingVertical: 16,
      paddingHorizontal: 8,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: adaptiveBorder,
    },

    selectedMood: {
      backgroundColor: isDark ? adaptivePrimarySoft : "#E3F2EF",
      borderColor: adaptivePrimary,
      borderWidth: 2,
      transform: [{ scale: 1.02 }],
    },

    moodEmoji: {
      fontSize: 28,
      marginBottom: 8,
    },

    moodLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: adaptiveTextSoft,
      textAlign: "center",
    },

    actionBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingTop: 14,
      backgroundColor: adaptiveBg,
      borderTopWidth: 1,
      borderTopColor: adaptiveBorder,
      gap: 12,
    },

    saveButton: {
      flex: 1,
      height: 56,
      borderRadius: 18,
      backgroundColor: adaptiveSurface,
      borderWidth: 1,
      borderColor: adaptiveBorder,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },

    saveButtonText: {
      fontSize: 15,
      fontWeight: "800",
      color: adaptivePrimary,
    },

    confirmButton: {
      flex: 1.6,
      height: 56,
      borderRadius: 18,
      backgroundColor: adaptivePrimary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      shadowColor: palette.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 18,
      elevation: 8,
    },

    confirmButtonText: {
      fontSize: 15,
      fontWeight: "800",
      color: palette.darkTextOnPrimary,
    },
  });
};

export default PostCalorieScreen;
