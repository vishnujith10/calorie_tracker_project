import { Ionicons } from "@expo/vector-icons";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from '../context/ThemeContext';
import supabase from "../lib/supabase";
import { createFoodLog } from "../utils/api";

// Shared palette — mirrors the teal design system used across the app
// (Home dashboard, Weight Tracker, Journal/Timeline, Daily Check-in,
// Deep Insights, Food Analysis, Text to Calorie, Settings, etc.)
const createPalette = (isDark) => ({
  primary: "#1F4E4A",
  primaryMuted: "#3D6A66",
  primaryLight: "#A8D5CE",
  background: isDark ? "#0F1E1C" : "#F4FBFA",
  card: isDark ? "#17302D" : "#FFFFFF",
  cardSecondary: isDark ? "#1C3935" : "#EEF7F5",
  textPrimary: isDark ? "#F4FBFA" : "#163633",
  textSecondary: isDark ? "#BED9D3" : "#5B7873",
  textMuted: isDark ? "#8FAAA5" : "#7D9994",
  border: isDark ? "#2C4A46" : "#D5E8E3",
  shadow: "#102624",
  destructive: "#B94F4F",
  destructiveSoft: isDark ? "#3A2426" : "#FBEBEC",
});

const VoiceCalorieScreen = ({ navigation, route }) => {
  const { mealType = "Quick Log", selectedDate } = route.params || {};
  const insets = useSafeAreaInsets(); // Get safe area insets for bottom navigation
  const { isDark } = useTheme();
  const palette = useMemo(() => createPalette(isDark), [isDark]);
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const recordingRef = useRef(null);
  const autoStopTimerRef = useRef(null);
  const ensureAudioPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const has = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (has) return true;
        const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        return res === PermissionsAndroid.RESULTS.GRANTED;
      }
      // iOS: rely on system prompt when starting recording (NSMicrophoneUsageDescription set)
      return true;
    } catch (error) {
      console.log('Permission error:', error);
      return false;
    }
  };
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConverting, setIsConverting] = useState(false); // Separate state for Convert button processing
  const [nutritionData, setNutritionData] = useState(null);
  const [transcribedText, setTranscribedText] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  
  useEffect(() => {
    if (!transcribedText) {
      setDisplayedText("");
      return;
    }
    let i = 0;
    setDisplayedText("");
    const interval = setInterval(() => {
      setDisplayedText(transcribedText.substring(0, i));
      i++;
      if (i > transcribedText.length) clearInterval(interval);
    }, 20); // typing speed
    return () => clearInterval(interval);
  }, [transcribedText]);
  const [lastRecordingUri, setLastRecordingUri] = useState(null);
  const micPulse = useRef(new Animated.Value(0)).current;
  // removed showListening state to avoid unused variable
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);

  // Recording animation removed

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        try {
          recordingRef.current.stopAndUnloadAsync && recordingRef.current.stopAndUnloadAsync();
        } catch (_e) {
          // ignore
        } finally {
          recordingRef.current = null;
        }
      }
    };
  }, []);

  // Recording animation removed

  const startRecording = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const hasPerm = await ensureAudioPermission();
      if (!hasPerm) {
        Alert.alert("Permission Required", "Microphone access is needed to record audio.");
        return;
      }
      if (recordingRef.current) {
        try {
          await (recordingRef.current.stopAndUnloadAsync && recordingRef.current.stopAndUnloadAsync());
        } catch (_e) {
          // ignore
        } finally {
          recordingRef.current = null;
        }
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      // Use smaller, faster recording profile to reduce upload/processing time
      const RECORDING_OPTIONS = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 22050,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.LOW,
          sampleRate: 22050,
          numberOfChannels: 1,
          bitRate: 64000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      };
      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      recordingRef.current = recording;
      setIsRecording(true);
      // listening indicator handled by animations only
      // Start mic pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(micPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(micPulse, { toValue: 0, duration: 700, useNativeDriver: true }),
        ])
      ).start();
      setNutritionData(null);
      setTranscribedText("");
      // No waveform animation; only mic pulse
      // Auto-stop after 8s to avoid long recordings/timeouts
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = setTimeout(() => {
        if (recordingRef.current) {
          stopRecording().catch(() => {});
        }
      }, 8000);
    } catch (_err) {
      console.log('startRecording error (VoiceCalorieScreen):', _err);
      Alert.alert("Recording Error", "Could not start recording.");
    }
  };

  const stopRecording = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsRecording(false);
    // Stop mic pulse
    micPulse.stopAnimation(() => {
      micPulse.setValue(0);
    });
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (!recordingRef.current) return;
    
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      
      if (uri) {
        // Ignore extremely short/empty clips (< 0.7s)
        try {
          const info = await FileSystem.getInfoAsync(uri);
          if (info?.size && info.size < 7000) {
            setTranscribedText("Could not hear you. Please try speaking a bit longer and closer to the mic.");
            return;
          }
        } catch {}
        setLastRecordingUri(uri);
        // Automatically transcribe when stopping to show what user said
        setIsLoading(true);
        await transcribeAudio(uri);
        setIsLoading(false);
      }
    } catch (_error) {
      console.log('Stop recording error:', _error);
      setIsLoading(false);
    }
  };

  // Utility: timeout wrapper for promises
  const raceWithTimeout = (promise, ms, timeoutMessage = 'Request timed out') => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), ms)),
    ]);
  };

  // Transcribe audio and show transcription
  const transcribeAudio = async (uri) => {
    try {
      const models = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-1.5-flash"];
      const audioData = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });
      
      const prompt = `Transcribe ONLY what the user said in this audio. Translate to English if needed, but return ONLY English text. Return ONLY the spoken words in English, no JSON, no punctuation, no explanations, no other languages.`;

      let text = '';
      for (const name of models) {
        try {
          const model = genAI.getGenerativeModel({ model: name });
          const result = await raceWithTimeout(
            model.generateContent([
              prompt,
              { inlineData: { mimeType: "audio/m4a", data: audioData } },
            ]),
            12000,
            'Transcription timed out'
          );
          const response = await result.response;
          text = response.text().trim();
          if (text) break;
        } catch (_e) {
          // try next model
        }
      }
      
      // Clean response
      text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      text = text.replace(/^["']|["']$/g, '');
      const jsonMatch = text.match(/\{[\s\S]*"transcription"\s*:\s*"([^"]+)"/);
      if (jsonMatch) text = jsonMatch[1];
      text = text.replace(/^transcription[:\s]*/i, '').trim();
      text = text.replace(/^["']|["']$/g, '').trim();
      
      if (text && text.length > 0) {
        setTranscribedText(text);
      }
    } catch (error) {
      console.log('Transcription error:', error);
      setTranscribedText("Could not transcribe audio. Please try again.");
    }
  };

  const handleVoiceToCalorie = async (uri) => {
    setIsLoading(true);
    setIsConverting(true); // Show full-screen loading modal
    try {
      // Try fastest → robust models sequentially
      const models = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-1.5-flash"];
      const audioData = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });
      
      const prompt = `Analyze the food items in this audio. Your response MUST be a single valid JSON object and nothing else. Do not include markdown formatting like \`\`\`json.

🌐 LANGUAGE REQUIREMENT:
- The transcription field MUST be in English only. Translate to English if needed, but return ONLY English text.
- All food item names must be in English.

🚨 CRITICAL QUANTITY PRESERVATION RULES 🚨
1. If the audio does NOT contain any food items or is unclear, respond with: {"error": "No food items detected. Please speak clearly about what you ate."}

2. 🚨 MOST IMPORTANT: ALWAYS preserve EXACT quantities and units mentioned in the audio:
   - If user says "200 grams of black beans" → you MUST output "200g black beans" (NOT "1 black beans")
   - If user says "150 grams of chicken" → you MUST output "150g chicken" (NOT "1 chicken")
   - If user says "1 cup of rice" → you MUST output "1 cup rice" (NOT "1 rice")
   - If user says "2 slices of bread" → you MUST output "2 bread" (NOT "1 bread")
   - If user says "500ml juice" → you MUST output "500ml juice" (NOT "1 juice")

3. 🚨 QUANTITY CONVERSION RULES:
   - "grams" → "g" (e.g., "200 grams" → "200g")
   - "milliliters" → "ml" (e.g., "500 milliliters" → "500ml")
   - "cups" → "cup" (e.g., "1 cup" → "1 cup")
   - "slices" → "slice" (e.g., "2 slices" → "2")
   - "pieces" → "piece" (e.g., "3 pieces" → "3")

4. 🚨 EXAMPLES OF CORRECT EXTRACTION:
   - "I had 200 grams of black beans" → extract "200g black beans"
   - "I ate 150 grams of chicken" → extract "150g chicken"
   - "I had 1 cup of rice" → extract "1 cup rice"
   - "I ate 2 slices of pizza" → extract "2 pizza"
   - "I had a chicken sandwich and a juice" → extract "1 chicken sandwich" and "1 juice"
   - "I ate 2 apples and a sandwich" → extract "2 apple" and "1 sandwich"
   - "I had 3 pieces of pizza" → extract "3 pizza"
   - "I had a burger and fries" → extract "1 burger" and "1 fries"

5. 🚨 WRONG EXAMPLES (DO NOT DO THIS):
   - "200 grams of black beans" → "1 black beans" ❌ WRONG!
   - "150g chicken" → "1 chicken" ❌ WRONG!
   - "1 cup rice" → "1 rice" ❌ WRONG!

6. If no specific quantity is mentioned, assume quantity of 1 (e.g., "1 sandwich", "1 juice")
7. Convert words to numbers: "one" → "1", "two" → "2", "three" → "3", etc.

8. 🚨 NUTRITION CALCULATION FOR GRAM-BASED ITEMS:
   - For "200g black beans": Calculate 2x the nutrition of 100g black beans
   - For "150g chicken": Calculate 1.5x the nutrition of 100g chicken
   - Black beans: ~120 calories per 100g, 8g protein, 22g carbs, 0.5g fat, 7g fiber
   - Chicken: ~165 calories per 100g, 31g protein, 0g carbs, 3.6g fat, 0g fiber

9. For complete dishes, use standard values:
   - Chicken sandwich: ~450 calories, 25g protein, 35g carbs, 20g fat, 3g fiber
   - Juice: ~120 calories, 1g protein, 30g carbs, 0g fat, 1g fiber
   - Pizza: ~280 calories, 12g protein, 30g carbs, 12g fat, 2g fiber
   - Burger: ~550 calories, 30g protein, 40g carbs, 25g fat, 3g fiber

The JSON object must have this structure: 
{ "transcription": "The full text of what you heard", "items": [ { "name": "EXACT_QUANTITY + food item", "calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number>, "fiber": <number> } ], "total": { "calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number>, "fiber": <number> } }`;

      let text = '';
      for (const name of models) {
        try {
          const model = genAI.getGenerativeModel({ model: name });
          const result = await raceWithTimeout(
            model.generateContent([
              prompt,
              { inlineData: { mimeType: "audio/m4a", data: audioData } },
            ]),
            30000,
            'Network request timed out. Please check your internet connection and try again.'
          );
          const response = await result.response;
          text = response.text();
          if (text) break;
        } catch (_e) {
          // try next model
        }
      }

      console.log("VoiceCalorieScreen - Raw AI response:", text);

      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonString = jsonMatch[0];
        console.log("VoiceCalorieScreen - Extracted JSON:", jsonString);
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
            "No food items detected. Please speak clearly about what you ate."
          );
        }
        
        // Update transcription if we got a new one from food analysis (may be more accurate)
        if (data.transcription) {
          setTranscribedText(data.transcription);
        }
        setNutritionData({ ...data.total, items: data.items });

        // Create clean food name from extracted items (just quantities and food names)
        const cleanFoodName = data.items
          .map((item) => item.name)
          .join(", ");

        console.log("VoiceCalorieScreen - Generated data:", data);
        console.log("VoiceCalorieScreen - Items:", data.items);
        console.log("VoiceCalorieScreen - Clean food name:", cleanFoodName);
        console.log("VoiceCalorieScreen - Total nutrition:", data.total);

        navigation.replace("VoicePostCalorieScreen", {
          analysis: {
            total: {
              calories: data.total.calories,
              protein: data.total.protein,
              fat: data.total.fat,
              carbs: data.total.carbs,
              fiber: data.total.fiber || 0,
            },
            items: data.items,
          },
          cleanFoodName: cleanFoodName,
        });
        return;
      } else {
        throw new Error(
          "Invalid JSON format from API. No JSON object found."
        );
      }
    } catch (error) {
      const msg = String(error?.message || "").toLowerCase();
      
      // Network and timeout errors
      if (
        msg.includes("timed out") ||
        msg.includes("timeout") ||
        msg.includes("network request timed out")
      ) {
        Alert.alert(
          "Network Error",
          "Connection is slow or timed out. Please check your internet connection and try again."
        );
      } else if (
        msg.includes("fetch") ||
        msg.includes("network") ||
        msg.includes("econnrefused") ||
        msg.includes("enotfound") ||
        msg.includes("err_internet_disconnected")
      ) {
        Alert.alert(
          "Network Error",
          "Unable to connect. Please check your internet connection and try again."
        );
      } else if (
        msg.includes("no food items detected") ||
        msg.includes("invalid json") ||
        msg.includes("no json object") ||
        msg.includes("empty") ||
        msg.includes("silence") ||
        msg.includes("404") ||
        msg.includes("not found") ||
        msg.includes("models/") ||
        msg.includes("generatecontent") ||
        msg.includes("api version") ||
        msg.includes("all ai models are currently unavailable")
      ) {
        Alert.alert(
          "Please speak more clearly",
          "We couldn't recognize the audio. Try moving closer to the mic and speaking a bit louder."
        );
      } else if (msg.includes("503") || msg.includes("overloaded")) {
        Alert.alert("AI busy", "Service is temporarily overloaded. Please try again in a few moments.");
      } else if (msg.includes("api key")) {
        Alert.alert("Configuration issue", "AI service configuration error. Please check your settings.");
      } else {
        Alert.alert("Please speak more clearly", "We couldn't recognize the audio. Try moving closer to the mic and speaking a bit louder.");
      }
      // no listening state toggle
    } finally {
      setIsLoading(false);
      setIsConverting(false); // Hide full-screen loading modal
    }
  };

  const handleConfirmLog = async () => {
    if (!nutritionData) return;
    try {
      const logData = {
        meal_type: mealType,
        food_name: nutritionData.items.map((i) => i.name).join(", "),
        calories: nutritionData.calories,
        protein: nutritionData.protein,
        carbs: nutritionData.carbs,
        fat: nutritionData.fat,
        date: selectedDate || new Date().toISOString().slice(0, 10),
        user_id: null,
      };
      const {
        data: { session },
      } = await supabase.auth.getSession();
      logData.user_id = session?.user?.id;
      if (!logData.user_id) {
        Alert.alert("You must be logged in to log food.");
        return;
      }
      await createFoodLog(logData);
      
      // Optimistic cache update (Instagram pattern)
      const { updateMainDashboardCacheOptimistic, updateHomeScreenCacheOptimistic, updateMainDashboardStreakOptimistic } = require('../utils/cacheManager');
      updateMainDashboardCacheOptimistic(logData);
      updateHomeScreenCacheOptimistic(logData);
      updateMainDashboardStreakOptimistic(); // Trigger streak update
      
      Alert.alert("Success", "Food logged successfully!", [
        { text: "OK", onPress: () => navigation.navigate("Home") },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to log food. " + error.message);
    }
  };

  const handleBackPress = () => {
    if (isRecording) {
      Alert.alert(
        "Stop Recording?",
        "Are you sure you want to stop recording and go back?",
        [
          {
            text: "No",
            style: "cancel",
            onPress: () => {
              // Continue recording - do nothing
            },
          },
          {
            text: "Yes",
            style: "destructive",
            onPress: async () => {
              // Stop recording and go back to home
              if (recordingRef.current) {
                try {
                  await recordingRef.current.stopAndUnloadAsync();
                  recordingRef.current = null;
                } catch (_error) {
                  // ignore
                }
              }
              setIsRecording(false);
              // No recording animation
              navigation.navigate("Home");
            },
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  // UI rendering logic
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {/* Full-screen loading overlay when processing Convert */}
      <Modal
        visible={isConverting}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
      >
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size={40} color={palette.primary} />
            <Text style={styles.loadingTitle}>Processing...</Text>
            <Text style={styles.loadingSubtext}>
              Analyzing your meal
            </Text>
          </View>
        </View>
      </Modal>

      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity onPress={handleBackPress} style={styles.heroBackBtn}>
            <Ionicons name="chevron-back" size={22} color={palette.primary} />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Voice Logging</Text>
          <View style={styles.heroSpacer} />
        </View>
      </View>
      <View style={styles.content}>
        {/* Top spacer for centering content */}
        <View style={styles.topSpacer} />

        {/* The Sentient Orb Visualizer */}
        <View style={styles.orbContainer}>
          {/* Animated Glow Rings */}
          <Animated.View style={[styles.orbGlow, {
            transform: [{ scale: micPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
            opacity: micPulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            backgroundColor: palette.primary
          }]} />
          <Animated.View style={[styles.orbGlow, {
            transform: [{ scale: micPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
            opacity: micPulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
            backgroundColor: palette.primaryMuted
          }]} />
          
          {/* Core Orb */}
          <Animated.View style={[styles.coreOrb, {
            transform: [{ scale: micPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
            shadowColor: palette.primary,
            shadowOpacity: micPulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }),
            shadowRadius: 30,
            backgroundColor: isRecording ? palette.primary : palette.background
          }]}>
            <LinearGradient
              colors={isRecording ? [palette.primaryMuted, palette.primary] : (isDark ? ['#234440', '#17302D'] : ['#FFFFFF', '#EEF7F5'])}
              style={styles.orbGradient}
            >
              <Ionicons 
                name={isRecording ? "radio-outline" : "mic"} 
                size={48} 
                color={isRecording ? "#FFFFFF" : palette.primary} 
              />
            </LinearGradient>
          </Animated.View>
        </View>

        {/* Transcription box - always visible, shows status and transcription */}
        <View style={styles.transcriptionCard}>
          <Text style={styles.transcriptionLabel}>
            {transcribedText ? "What you said:" : isRecording ? "Recording..." : "Transcription"}
          </Text>
          <View style={styles.transcriptionBubble}>
            {/* Only show loading in transcription box if we don't have transcribedText yet (i.e., during transcription after Stop) */}
            {isLoading && !transcribedText ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
                <ActivityIndicator size="small" color={palette.primary} />
                <Text style={[styles.transcriptionText, { marginLeft: 10 }]}>
                  Processing...
                </Text>
              </View>
            ) : (
              <Text style={styles.transcriptionText}>
                {transcribedText 
                  ? (displayedText + (displayedText.length < transcribedText.length ? "▋" : ""))
                  : isRecording 
                  ? "Listening..." 
                  : "Tap Start to begin recording"}
              </Text>
            )}
          </View>
        </View>

        {/* Results - stays in center when showing */}
        {nutritionData && !isLoading && (
          <View style={styles.resultContainer}>
            <View style={styles.foodListContainer}>
              {nutritionData.items.map((item, idx) => (
                <View key={idx} style={styles.foodItemRow}>
                  <Ionicons
                    name="fast-food-outline"
                    size={22}
                    color={palette.primary}
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foodItemName}>{item.name}</Text>
                    <Text style={styles.foodItemKcal}>
                      {item.calories} kcal
                    </Text>
                  </View>
                  <TouchableOpacity>
                    <Ionicons name="pencil-outline" size={20} color={palette.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={styles.suggestedMealRow}>
              <Text style={styles.suggestedMealLabel}>Suggested Meal</Text>
              <TouchableOpacity>
                <Text style={styles.suggestedMealValue}>{mealType}</Text>
                <Ionicons
                  name="pencil-outline"
                  size={16}
                  color={palette.textSecondary}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>Time</Text>
              <TouchableOpacity>
                <Text style={styles.timeValue}>
                  {selectedDate
                    ? new Date(selectedDate).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--"}
                </Text>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={palette.textSecondary}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.editFoodsBtn}>
              <Text style={styles.editFoodsBtnText}>Edit Foods</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setNutritionData(null);
                setTranscribedText("");
              }}
            >
              <Ionicons
                name="refresh"
                size={18}
                color={palette.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.retryBtnText}>Retry Voice Input</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Instructions section at top */}
        <View style={styles.instructionsSection}>
          {!isRecording && !nutritionData && (
            <>
              <Text style={styles.instructions}>
                Speak naturally – Kalry listens & structures it
              </Text>
              <Text style={styles.sampleText}>
                Try: &quot;I had a chicken sandwich and a juice&quot;
              </Text>
            </>
          )}
          {isRecording && !nutritionData && (
            <>
              <Text style={styles.listeningText}>Listening...</Text>
              <Text style={styles.instructions}>
                Speak naturally – Kalry listens & structures it
              </Text>
              <Text style={styles.sampleText}>
                Try: &quot;I had a chicken sandwich and a juice&quot;
              </Text>
            </>
          )}
        </View>

        {/* Action buttons row above bottom */}
        <View style={[styles.actionRow, styles.actionRowFixed, { bottom: insets.bottom >= 20 ? (110 + insets.bottom) : 110 }]}>
          <TouchableOpacity
            style={[styles.startBtn, isRecording && { opacity: 0.6 }]}
            onPress={startRecording}
            disabled={isRecording || isLoading}
          >
            <Ionicons name="play" size={18} color={palette.primary} style={{ marginRight: 8 }} />
            <Text style={styles.startBtnText}>Start</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.stopBtn, !isRecording && { opacity: 0.6 }]}
            onPress={stopRecording}
            disabled={!isRecording || isLoading}
          >
            <Ionicons name="stop" size={16} color={palette.destructive} style={{ marginRight: 8 }} />
            <Text style={styles.stopBtnText}>Stop</Text>
          </TouchableOpacity>
        </View>

        {/* Convert button fixed at screen bottom */}
        <TouchableOpacity
          style={[styles.convertBtn, styles.convertFixed, (!lastRecordingUri || isLoading) && { opacity: 0.6 }, { bottom: insets.bottom >= 20 ? (insets.bottom + 20) : 20 }]}
          onPress={() => lastRecordingUri && handleVoiceToCalorie(lastRecordingUri)}
          disabled={!lastRecordingUri || isLoading}
        >
          <Text style={styles.convertBtnText}>Convert to Calories  →</Text>
        </TouchableOpacity>
      </View>
      {/* Fixed footer for action buttons */}
      {nutritionData && !isLoading && (
        <View style={[styles.footerActionRow, { bottom: insets.bottom >= 20 ? (insets.bottom + 20) : 20 }]}>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleConfirmLog}
          >
            <Text style={styles.confirmBtnText}>Confirm & Log</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const createStyles = (palette, isDark) => StyleSheet.create({
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

  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    justifyContent: "flex-start",
    width: "100%",
  },
  topSpacer: { height: 12 },

  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 240,
    marginTop: 30,
  },
  orbGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  coreOrb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
  },
  orbGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  transcriptionCard: {
    width: "100%",
    marginTop: 40,
    paddingHorizontal: 4,
  },
  transcriptionLabel: {
    color: palette.primary,
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    marginLeft: 6,
    marginBottom: 8,
  },
  transcriptionBubble: {
    backgroundColor: palette.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.25 : 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  transcriptionText: {
    color: palette.textPrimary,
    fontFamily: "Manrope-Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  instructionsSection: {
    width: "100%",
    alignItems: "center",
    paddingTop: 36,
    paddingBottom: 20,
    marginTop: 14,
  },
  actionRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    marginTop: 18,
  },
  actionRowFixed: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 110,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.cardSecondary,
    paddingVertical: 14,
    borderRadius: 20,
    paddingHorizontal: 22,
    width: "48%",
    borderWidth: 1,
    borderColor: palette.border,
  },
  startBtnText: {
    color: palette.primary,
    fontFamily: "Lexend-SemiBold",
    fontSize: 15,
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.destructiveSoft,
    paddingVertical: 14,
    borderRadius: 20,
    paddingHorizontal: 22,
    width: "48%",
    borderWidth: 1,
    borderColor: palette.border,
  },
  stopBtnText: {
    color: palette.destructive,
    fontFamily: "Lexend-SemiBold",
    fontSize: 15,
  },
  convertBtn: {
    width: "100%",
    backgroundColor: palette.primary,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 18,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 5,
  },
  convertBtnText: {
    color: "#FFFFFF",
    fontFamily: "Lexend-SemiBold",
    fontSize: 15,
  },
  convertFixed: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 20,
  },
  instructions: {
    color: palette.textSecondary,
    marginTop: 8,
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    textAlign: "center",
  },
  sampleText: {
    color: palette.textMuted,
    marginTop: 2,
    fontSize: 12.5,
    fontFamily: "Manrope-Regular",
    textAlign: "center",
  },
  listeningText: {
    color: palette.primary,
    fontFamily: "Lexend-Bold",
    marginBottom: 8,
    fontSize: 17,
    textAlign: "center",
  },
  resultContainer: { width: "100%", marginTop: 10, alignItems: "center" },
  foodListContainer: { width: "100%", marginBottom: 16 },
  foodItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  foodItemName: {
    fontSize: 14.5,
    fontFamily: "Lexend-SemiBold",
    color: palette.textPrimary,
  },
  foodItemKcal: {
    fontSize: 12.5,
    fontFamily: "Manrope-Regular",
    color: palette.textSecondary,
  },
  suggestedMealRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  suggestedMealLabel: {
    color: palette.textSecondary,
    fontFamily: "Manrope-Regular",
    fontSize: 13.5,
  },
  suggestedMealValue: {
    color: palette.textPrimary,
    fontFamily: "Lexend-SemiBold",
    fontSize: 14.5,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  timeLabel: {
    color: palette.textSecondary,
    fontFamily: "Manrope-Regular",
    fontSize: 13.5,
  },
  timeValue: {
    color: palette.textPrimary,
    fontFamily: "Lexend-SemiBold",
    fontSize: 14.5,
  },
  editFoodsBtn: {
    backgroundColor: palette.cardSecondary,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    marginBottom: 10,
    width: "100%",
    borderWidth: 1,
    borderColor: palette.border,
  },
  editFoodsBtnText: {
    color: palette.primary,
    fontFamily: "Lexend-SemiBold",
    fontSize: 14.5,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  retryBtnText: {
    color: palette.primary,
    fontFamily: "Lexend-SemiBold",
    fontSize: 14.5,
  },
  footerActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    padding: 18,
    backgroundColor: palette.card,
    borderTopWidth: 1,
    borderColor: palette.border,
    position: "absolute",
    left: 0,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: palette.primary,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    marginRight: 8,
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontFamily: "Lexend-SemiBold",
    fontSize: 15,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: palette.cardSecondary,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.border,
  },
  cancelBtnText: {
    color: palette.primary,
    fontFamily: "Lexend-SemiBold",
    fontSize: 15,
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: "rgba(16, 38, 36, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    backgroundColor: palette.card,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 200,
    maxWidth: 250,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.4 : 0.2,
    shadowRadius: 12,
    elevation: Platform.OS === 'android' ? 0 : 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  loadingTitle: {
    fontSize: 16,
    fontFamily: "Lexend-Bold",
    color: palette.textPrimary,
    marginTop: 16,
    textAlign: "center",
  },
  loadingSubtext: {
    fontSize: 12.5,
    fontFamily: "Manrope-Regular",
    color: palette.textSecondary,
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 10,
  },
});

export default VoiceCalorieScreen;