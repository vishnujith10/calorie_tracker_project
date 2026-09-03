import { Ionicons } from '@expo/vector-icons';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import supabase from '../lib/supabase';
import { createFoodLog } from '../utils/api';

// Shared palette — mirrors the teal design system used across the app
// (Home dashboard, Weight Tracker, Journal/Timeline, Daily Check-in,
// Deep Insights, Voice Food Analysis, Text to Calorie, Settings, etc.)
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

const PhotoCalorieScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets(); // Get safe area insets for bottom navigation
  const photoUri = route.params?.photoUri || route.params?.imageUri;
  const { mealType } = route.params || {};
  const { isDark } = useTheme();
  const palette = useMemo(() => createPalette(isDark), [isDark]);
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const [isLoading, setIsLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [editedFoodName, setEditedFoodName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [selectedMood, setSelectedMood] = useState(null);
  const [macros, setMacros] = useState({
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  });

  const moodOptions = [
    { emoji: '😀', label: 'Happy' },
    { emoji: '😊', label: 'Content' },
    { emoji: '😐', label: 'Neutral' },
    { emoji: '😞', label: 'Sad' },
    { emoji: '😴', label: 'Tired' },
    { emoji: '😤', label: 'Stressed' },
  ];

  // Initialize Gemini AI
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    console.error('PhotoCalorieScreen - No API key found!');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const visionModels = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];

  useEffect(() => {
    if (photoUri) {
      analyzePhoto();
    } else {
      console.log("PhotoCalorieScreen - Missing photoUri parameters:", route.params);
      Alert.alert("Error", "No image provided for analysis.", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUri]);

  const analyzePhoto = async () => {
    console.log('PhotoCalorieScreen - analyzePhoto started. photoUri:', photoUri);
    setIsLoading(true);
    try {
      // Timeout wrapper for network requests
      const raceWithTimeout = (promise, ms, timeoutMessage = 'The model is taking more time to respond. Please try again.') => {
        return Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), ms)),
        ]);
      };

      let lastError = null;

      for (const modelName of visionModels) {
        console.log(`PhotoCalorieScreen - Trying model: ${modelName}`);
        try {
          console.log(`PhotoCalorieScreen - genAI.getGenerativeModel for ${modelName}`);
          const model = genAI.getGenerativeModel({ model: modelName });

          console.log(`PhotoCalorieScreen - Reading file as base64...`);
          const imageData = await FileSystem.readAsStringAsync(photoUri, {
            encoding: 'base64',
          });
          console.log(`PhotoCalorieScreen - File read complete. Length: ${imageData?.length}`);

          const prompt = `Analyze this food image and provide detailed nutritional information. Your response MUST be a single valid JSON object and nothing else. Do not include markdown formatting.

If the image does NOT contain recognizable food items, respond with: {"error": "No food items detected in this image. Please take a photo of food items."}

If food is detected, provide this exact JSON structure:
{
  "dish_name": "Main dish name (e.g., 'Grilled Chicken Salad')",
  "ingredients": [
    {
      "name": "ingredient name",
      "quantity": "estimated amount (e.g., '100g', '1 cup', '2 slices')"
    }
  ],
  "total_nutrition": {
    "calories": <number>,
    "protein": <number>,
    "fat": <number>,
    "carbs": <number>,
    "fiber": <number>,
    "micronutrients": {
      "iron": <boolean>,
      "potassium": <boolean>,
      "vitaminC": <boolean>,
      "calcium": <boolean>
    }
  },
  "confidence_level": <number between 0-100>
}

Guidelines:
- Be realistic with portion sizes
- Consider cooking methods (fried foods have more calories)
- Include all visible ingredients
- Provide nutritional values per the entire visible portion
- Confidence should reflect how clearly you can identify the food`;

          // Add timeout (25 seconds) for photo vision analysis
          const result = await raceWithTimeout(
            model.generateContent([
              prompt,
              { inlineData: { mimeType: "image/jpeg", data: imageData } },
            ]),
            25000,
            'The model is taking more time to respond. Please try again.'
          );

          const response = await result.response;
          let text = response.text();

          console.log('PhotoCalorieScreen - Raw AI response:', text);

          const jsonMatch = text.match(/\{[\s\S]*\}/);

          if (jsonMatch) {
            const jsonString = jsonMatch[0];
            console.log('PhotoCalorieScreen - Extracted JSON:', jsonString);
            const data = JSON.parse(jsonString);

            if (data.error) {
              throw new Error(data.error);
            }

            if (!data.dish_name || !data.total_nutrition || !Array.isArray(data.ingredients)) {
              throw new Error('Invalid JSON structure from API.');
            }

            setAnalysis(data);
            setCurrentAnalysis(data);
            setEditedFoodName(data.dish_name);
            setMacros({
              protein: data.total_nutrition.protein || 0,
              carbs: data.total_nutrition.carbs || 0,
              fat: data.total_nutrition.fat || 0,
              fiber: data.total_nutrition.fiber || 0,
            });

            console.log('PhotoCalorieScreen - Analysis complete:', data);
            return;
          } else {
            throw new Error('Invalid JSON format from API.');
          }
        } catch (error) {
          lastError = error;
          console.log(`Model ${modelName} failed:`, error.message);
        }
      }

      throw lastError || new Error('The model is taking more time to respond. Please try again.');

    } catch (error) {
      console.error('PhotoCalorieScreen - Analysis error:', error);
      const msg = String(error?.message || "").toLowerCase();

      // Network and timeout errors
      if (
        msg.includes("timed out") ||
        msg.includes("timeout") ||
        msg.includes("taking more time") ||
        msg.includes("network request timed out")
      ) {
        Alert.alert(
          "Request Timeout",
          "The model is taking more time to respond. Please try again."
        );
      } else if (
        msg.includes("fetch") ||
        msg.includes("network") ||
        msg.includes("econnrefused") ||
        msg.includes("enotfound") ||
        msg.includes("err_internet_disconnected")
      ) {
        const isModelMissing = msg.includes('model') && msg.includes('not found');
        const title = isModelMissing ? 'Service Update Needed' : 'Network Error';
        const message = isModelMissing
          ? 'The selected AI model is no longer available. Please update to the latest app version or configure a supported Gemini model.'
          : 'Unable to connect. Please check your internet connection and try again.';
        Alert.alert(title, message);
      } else if (
        msg.includes("no food items detected") ||
        msg.includes("invalid json") ||
        msg.includes("no json object")
      ) {
        setShowErrorModal(true);
      } else {
        Alert.alert(
          "Analysis Failed",
          "We couldn't analyze this image. Please try taking another photo with better lighting and food clearly visible."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    const analysisToUse = currentAnalysis || analysis;
    if (!analysisToUse) return;
    try {
      const { dish_name } = analysisToUse;
      const { data: { session } } = await supabase.auth.getSession();
      const user_id = session?.user?.id;

      if (!user_id) {
        Alert.alert('You must be logged in to log food.');
        return;
      }

      // Get selected mood emoji
      const selectedMoodEmoji = selectedMood !== null ? moodOptions[selectedMood].emoji : null;

      // Upload photo to Supabase Storage
      let photoUrl = null;
      try {
        const fileName = `food_photos/${user_id}_${Date.now()}.jpg`;
        console.log('Upload - step 1: fileName:', fileName);
        console.log('Upload - step 2: photoUri:', photoUri);

        // Get auth token for the upload request
        const { data: { session: uploadSession } } = await supabase.auth.getSession();
        const authToken = uploadSession?.access_token;
        console.log('Upload - step 3: authToken exists:', !!authToken);

        if (!authToken) throw new Error('No auth token available');

        const supabaseUrl = 'https://tkuyjtdycmmkvunurlxj.supabase.co';
        const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrdXlqdGR5Y21ta3Z1bnVybHhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzIwMDYsImV4cCI6MjA4OTQwODAwNn0.Vs1fjhWuGK93s2vbe3mcj-nLQaCcKXGVQW3LjnpD2VY';
        const uploadUrl = `${supabaseUrl}/storage/v1/object/food-photos/${fileName}`;
        console.log('Upload - step 4: uploadUrl:', uploadUrl);

        // Use FileSystem.uploadAsync — the only reliable way to upload binary files in Expo/Hermes
        const uploadResult = await FileSystem.uploadAsync(
          uploadUrl,
          photoUri,
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

        console.log('Upload - step 5: status:', uploadResult.status, 'body:', uploadResult.body);

        if (uploadResult.status >= 200 && uploadResult.status < 300) {
          // Store the storage path for later retrieval with signed URL
          photoUrl = fileName;
          console.log('Photo uploaded successfully:', fileName);
        } else {
          throw new Error(`Upload failed with status ${uploadResult.status}: ${uploadResult.body}`);
        }
      } catch (uploadError) {
        console.error('Photo upload error:', uploadError);
        // Continue without photo URL
      }

      const logData = {
        meal_type: mealType,
        food_name: editedFoodName || dish_name,
        calories: analysisToUse.total_nutrition.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        fiber: macros.fiber,
        mood: selectedMoodEmoji,
        photo_url: photoUrl,
        user_id,
        date: new Date().toISOString().slice(0, 10),
      };

      await createFoodLog(logData);

      // Optimistic cache update with local URI for immediate rendering
      const { updateMainDashboardCacheOptimistic, updateHomeScreenCacheOptimistic, updateMainDashboardStreakOptimistic } = require('../utils/cacheManager');
      const cacheData = { ...logData, photo_url: photoUrl ? photoUri : null };
      updateMainDashboardCacheOptimistic(cacheData);
      updateHomeScreenCacheOptimistic(cacheData);
      updateMainDashboardStreakOptimistic(); // Trigger streak update

      // Show generic success message
      Alert.alert(
        "Food Logged! 🍽️",
        "Your meal has been manually logged successfully.",
        [{
          text: "Great!",
          style: "default",
          onPress: () => navigation.replace('Home')
        }]
      );

    } catch (error) {
      console.error('Error logging food:', error);
      Alert.alert('Error', 'Failed to log food. ' + error.message);
    }
  };

  const handleSaveToSavedMeals = async () => {
    const analysisToUse = currentAnalysis || analysis;
    if (!analysisToUse) return;
    try {
      const { dish_name, total_nutrition, ingredients } = analysisToUse;
      const { data: { session: saveSession } } = await supabase.auth.getSession();
      const user_id = saveSession?.user?.id;
      const authToken = saveSession?.access_token;

      if (!user_id) {
        Alert.alert('You must be logged in to save meals.');
        return;
      }

      // Upload photo to Supabase Storage
      let photoUrl = null;
      if (photoUri && authToken) {
        try {
          const fileName = `food_photos/${user_id}_${Date.now()}.jpg`;
          const supabaseUrl = 'https://tkuyjtdycmmkvunurlxj.supabase.co';
          const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrdXlqdGR5Y21ta3Z1bnVybHhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzIwMDYsImV4cCI6MjA4OTQwODAwNn0.Vs1fjhWuGK93s2vbe3mcj-nLQaCcKXGVQW3LjnpD2VY';
          const uploadUrl = `${supabaseUrl}/storage/v1/object/food-photos/${fileName}`;
          console.log('SaveMeal - uploading photo to:', uploadUrl);

          const uploadResult = await FileSystem.uploadAsync(uploadUrl, photoUri, {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            headers: {
              Authorization: `Bearer ${authToken}`,
              apikey: supabaseAnonKey,
              'Content-Type': 'image/jpeg',
              'x-upsert': 'false',
            },
          });

          console.log('SaveMeal - upload status:', uploadResult.status, 'body:', uploadResult.body);

          if (uploadResult.status >= 200 && uploadResult.status < 300) {
            photoUrl = fileName;
            console.log('SaveMeal - photo uploaded successfully:', fileName);
          } else {
            console.error('SaveMeal - upload failed:', uploadResult.status, uploadResult.body);
          }
        } catch (uploadError) {
          console.error('SaveMeal - photo upload error:', uploadError);
        }
      }

      const ingredientSummary = ingredients
        ? ingredients.map(i => `${i.quantity || ''} ${i.name}`.trim()).join(', ')
        : '';
      const { error } = await supabase
        .from('saved_meal')
        .insert({
          user_id,
          dish_name: editedFoodName || dish_name,
          description: ingredientSummary,
          calories: Math.round(total_nutrition.calories || 0),
          protein: Math.round(macros.protein || 0),
          carbs: Math.round(macros.carbs || 0),
          fat: Math.round(macros.fat || 0),
          fiber: Math.round(macros.fiber || 0),
          photo_url: photoUrl,
        });

      if (error) throw error;

      // Invalidate SavedMealsScreen cache to force refresh
      try {
        const { globalSavedMealsCache } = require('./SavedMealsScreen');
        if (globalSavedMealsCache) {
          globalSavedMealsCache.cachedData = null;
          globalSavedMealsCache.lastFetchTime = 0;
        }
      } catch (cacheError) {
        console.log('Could not invalidate cache:', cacheError);
      }

      Alert.alert(
        'Meal Saved! 💾',
        `This meal has been added to your Saved Meals for easy logging later!`,
        [{
          text: 'Great!',
          onPress: () => navigation.navigate('SavedMealsScreen', { refresh: true })
        }]
      );

    } catch (error) {
      console.error('Error saving meal:', error);
      Alert.alert('Error', 'Failed to save meal. ' + error.message);
    }
  };

  // Re-analyze food name using AI
  const handleReanalyzeFood = async () => {
    if (!editedFoodName || editedFoodName.trim().length < 2) {
      Alert.alert('Error', 'Please enter a valid food name');
      return;
    }

    if (!genAI) {
      Alert.alert('Error', 'AI service is not available');
      return;
    }

    setIsReanalyzing(true);
    try {
      const models = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];
      let lastError = null;

      for (const modelName of models) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });

          const prompt = `Analyze the following meal text: "${editedFoodName}". Your response MUST be a single valid JSON object and nothing else. Do not include markdown formatting like \`\`\`json.

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

          const raceWithTimeout = (promise, ms, timeoutMessage = 'The model is taking more time to respond. Please try again.') => {
            return Promise.race([
              promise,
              new Promise((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), ms)),
            ]);
          };

          const result = await raceWithTimeout(
            model.generateContent(prompt),
            15000,
            'The model is taking more time to respond. Please try again.'
          );
          const response = await result.response;
          let text = response.text();
          console.log("PhotoCalorieScreen - Re-analysis raw response:", text);

          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jsonString = jsonMatch[0];
            const data = JSON.parse(jsonString);

            // Check for error response
            if (data.error) {
              throw new Error(data.error);
            }

            if (!data.total || !Array.isArray(data.items) || !data.transcription) {
              throw new Error("Invalid JSON structure from API.");
            }

            // Convert voice analysis format to photo analysis format
            const newAnalysis = {
              dish_name: editedFoodName,
              ingredients: data.items.map(item => ({
                name: item.name,
                quantity: item.name, // Use name as quantity since it contains quantity
              })),
              total_nutrition: {
                calories: data.total.calories,
                protein: data.total.protein,
                carbs: data.total.carbs,
                fat: data.total.fat,
                fiber: data.total.fiber || 0,
                micronutrients: analysis?.total_nutrition?.micronutrients || {},
              },
              confidence_level: analysis?.confidence_level || 85,
            };

            setCurrentAnalysis(newAnalysis);
            setAnalysis(newAnalysis);

            // Update macros
            setMacros({
              protein: data.total.protein || 0,
              carbs: data.total.carbs || 0,
              fat: data.total.fat || 0,
              fiber: data.total.fiber || 0,
            });

            setIsEditing(false);
            Alert.alert('Success', 'Food re-analyzed successfully!');
            return;
          } else {
            throw new Error('Invalid JSON format from API.');
          }
        } catch (error) {
          lastError = error;
          console.log(`Model ${modelName} failed:`, error.message);
        }
      }

      throw lastError || new Error('The model is taking more time to respond. Please try again.');
    } catch (error) {
      console.error('PhotoCalorieScreen - Re-analysis error:', error);
      const isTimeout = error?.message?.includes('taking more time') || error?.message?.includes('timed out');
      Alert.alert(
        isTimeout ? 'Request Timeout' : 'Error',
        isTimeout
          ? 'The model is taking more time to respond. Please try again.'
          : (error.message || 'Failed to re-analyze food. Please try again.')
      );
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleRetakePhoto = () => {
    navigation.goBack();
  };

  const handleErrorRetry = () => {
    setShowErrorModal(false);
    navigation.goBack();
  };

  if (showErrorModal) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.stateContainer}>
          <View style={styles.stateIconShell}>
            <Ionicons name="camera-outline" size={40} color={palette.primary} />
          </View>
          <Text style={styles.stateTitle}>No Food Detected</Text>
          <Text style={styles.stateMessage}>
            We couldn&apos;t identify any food in this image. Please try taking another photo with:
          </Text>
          <View style={styles.tipsCard}>
            <View style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipRowText}>Good lighting</Text>
            </View>
            <View style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipRowText}>Food clearly visible</Text>
            </View>
            <View style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipRowText}>Camera focused on the food</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.stateButton} onPress={handleErrorRetry} activeOpacity={0.9}>
            <Text style={styles.stateButtonText}>Take Another Photo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.stateContainer}>
          <ActivityIndicator size={44} color={palette.primary} />
          <Text style={styles.loadingTitle}>Analyzing your food...</Text>
          <Text style={styles.stateMessage}>This may take a few seconds</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!analysis) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.stateContainer}>
          <View style={[styles.stateIconShell, styles.stateIconShellDestructive]}>
            <Ionicons name="alert-circle-outline" size={40} color={palette.destructive} />
          </View>
          <Text style={styles.stateTitle}>Analysis Failed</Text>
          <Text style={styles.stateMessage}>
            We couldn&apos;t analyze this image. Please try taking another photo.
          </Text>
          <TouchableOpacity style={styles.stateButton} onPress={handleRetakePhoto} activeOpacity={0.9}>
            <Text style={styles.stateButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Header */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.heroBackBtn}>
            <Ionicons name="chevron-back" size={22} color={palette.primary} />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Food Analysis</Text>
          <View style={styles.heroSpacer} />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom >= 20 ? (insets.bottom + 20) : 20 }}
      >
        {/* Photo */}
        <View style={styles.photoContainer}>
          <Image
            source={{
              uri: photoUri || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
            }}
            style={styles.photo}
          />
          <TouchableOpacity style={styles.retakeButton} onPress={handleRetakePhoto} activeOpacity={0.85}>
            <Ionicons name="camera-outline" size={17} color={palette.primary} />
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
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
                      <Ionicons name="checkmark-circle" size={22} color={palette.primary} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIsEditing(false)}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="close-circle-outline" size={22} color={palette.textSecondary} />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.iconBtn}>
                  <Ionicons name="pencil-outline" size={18} color={palette.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          {isEditing ? (
            <TextInput
              style={[styles.foodName, styles.editableText]}
              value={editedFoodName}
              onChangeText={setEditedFoodName}
              placeholder="Enter food name"
              placeholderTextColor={palette.textMuted}
              autoFocus
            />
          ) : (
            <Text style={styles.foodName}>{editedFoodName || (currentAnalysis || analysis)?.dish_name}</Text>
          )}
          <View style={styles.confidenceChip}>
            <Text style={styles.confidenceText}>
              Confidence: {(currentAnalysis || analysis)?.confidence_level || 85}%
            </Text>
          </View>
        </View>

        {/* Nutrition Summary */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Nutrition Summary</Text>
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{(currentAnalysis || analysis)?.total_nutrition?.calories || 0}</Text>
              <Text style={styles.nutritionLabel}>Calories</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{macros.protein}g</Text>
              <Text style={styles.nutritionLabel}>Protein</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{macros.carbs}g</Text>
              <Text style={styles.nutritionLabel}>Carbs</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{macros.fat}g</Text>
              <Text style={styles.nutritionLabel}>Fat</Text>
            </View>
          </View>
        </View>

        {/* Ingredients */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ingredients Detected</Text>
          <View style={styles.ingredientList}>
            {((currentAnalysis || analysis)?.ingredients && (currentAnalysis || analysis).ingredients.length > 0) && (currentAnalysis || analysis).ingredients.map((ingredient, index) => (
              <View key={index} style={[styles.ingredientItem, index !== 0 && styles.ingredientItemDivider]}>
                <View style={styles.ingredientDot} />
                <View style={styles.ingredientInfo}>
                  <Text style={styles.ingredientName}>{ingredient.name}</Text>
                  <Text style={styles.ingredientQuantity}>{ingredient.quantity}</Text>
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
                  selectedMood === index && styles.selectedMood
                ]}
                onPress={() => setSelectedMood(selectedMood === index ? null : index)}
                activeOpacity={0.85}
              >
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={[styles.moodLabel, selectedMood === index && styles.moodLabelActive]}>{mood.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionContainer, { paddingBottom: insets.bottom >= 20 ? (insets.bottom + 20) : 20 }]}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveToSavedMeals}
          activeOpacity={0.85}
        >
          <Ionicons name="bookmark-outline" size={19} color={palette.primary} />
          <Text style={styles.saveButtonText}>Save Meal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirm}
          activeOpacity={0.9}
        >
          <Text style={styles.confirmButtonText}>Log Food</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
};

const createStyles = (palette, isDark) => StyleSheet.create({
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 19,
    fontFamily: 'Lexend-Bold',
    color: palette.textPrimary,
  },
  heroSpacer: { width: 40 },

  // Photo
  photoContainer: {
    position: 'relative',
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 200,
  },
  retakeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: isDark ? 'rgba(23,48,45,0.85)' : 'rgba(255,255,255,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  retakeText: {
    marginLeft: 4,
    fontSize: 13,
    fontFamily: 'Lexend-SemiBold',
    color: palette.primary,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Lexend-Bold',
    color: palette.textPrimary,
    marginBottom: 10,
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: -10,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodName: {
    fontSize: 17,
    fontFamily: 'Lexend-SemiBold',
    color: palette.textPrimary,
    marginBottom: 8,
  },
  editableText: {
    borderBottomWidth: 1.5,
    borderBottomColor: palette.primary,
    paddingVertical: 4,
  },
  confidenceChip: {
    alignSelf: 'flex-start',
    backgroundColor: palette.cardSecondary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  confidenceText: {
    fontSize: 12,
    fontFamily: 'Manrope-SemiBold',
    color: palette.textSecondary,
  },

  // Nutrition grid
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: palette.cardSecondary,
    borderRadius: 18,
    padding: 14,
  },
  nutritionItem: {
    alignItems: 'center',
    flex: 1,
  },
  nutritionValue: {
    fontSize: 18,
    fontFamily: 'Lexend-Bold',
    color: palette.primary,
  },
  nutritionLabel: {
    fontSize: 11,
    fontFamily: 'Manrope-SemiBold',
    color: palette.textSecondary,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Ingredients
  ingredientList: {
    backgroundColor: palette.cardSecondary,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontFamily: 'Lexend-SemiBold',
    color: palette.textPrimary,
    marginBottom: 2,
  },
  ingredientQuantity: {
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    color: palette.textSecondary,
  },

  // Mood grid
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  moodOption: {
    width: '30%',
    alignItems: 'center',
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
    fontFamily: 'Manrope-SemiBold',
    color: palette.textSecondary,
  },
  moodLabelActive: {
    color: palette.primary,
    fontFamily: 'Lexend-SemiBold',
  },

  // Action buttons
  actionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: 'Lexend-SemiBold',
    color: palette.primary,
  },
  confirmButton: {
    flex: 1.4,
    backgroundColor: palette.primary,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 4,
  },
  confirmButtonText: {
    fontSize: 15,
    fontFamily: 'Lexend-SemiBold',
    color: '#FFFFFF',
  },

  // Loading / error states
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  stateIconShell: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: palette.cardSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: palette.border,
  },
  stateIconShellDestructive: {
    backgroundColor: isDark ? '#3A2426' : '#FBEBEC',
  },
  loadingTitle: {
    fontSize: 17,
    fontFamily: 'Lexend-Bold',
    color: palette.textPrimary,
    marginTop: 18,
    textAlign: 'center',
  },
  stateTitle: {
    fontSize: 21,
    fontFamily: 'Lexend-Bold',
    color: palette.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  stateMessage: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    color: palette.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 8,
  },
  tipsCard: {
    width: '100%',
    backgroundColor: palette.cardSecondary,
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
    marginBottom: 26,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.primary,
    marginRight: 10,
  },
  tipRowText: {
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
    color: palette.textSecondary,
  },
  stateButton: {
    backgroundColor: palette.primary,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 32,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 5,
  },
  stateButtonText: {
    fontSize: 15,
    fontFamily: 'Lexend-SemiBold',
    color: '#FFFFFF',
  },
});

export default PhotoCalorieScreen;