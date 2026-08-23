import { Ionicons } from '@expo/vector-icons';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Easing, Modal, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import supabase from '../lib/supabase';
import { createFoodLog } from '../utils/api';

const CalorieFooter = ({ navigation, activeTab }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  const [plusLayout, setPlusLayout] = useState(null);
  const plusRef = useRef();
  const [photoOptionsVisible, setPhotoOptionsVisible] = useState(false);

  // Animate button press
  const handlePlusPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.93,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  };
  const handlePlusPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
    setTimeout(() => {
      setModalVisible(true);
      Animated.timing(modalAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }, 80);
  };
  const handleModalClose = () => {
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => setModalVisible(false));
  };

  // Get plus button position for modal origin
  const handlePlusLayout = (event) => {
    setPlusLayout(event.nativeEvent.layout);
  };

  // Modal animation: scale and translate from plus button
  const { width, height } = Dimensions.get('window');
  const modalScale = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 1],
  });
  const modalTranslateY = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [plusLayout ? plusLayout.y - height / 2 + 28 : 0, 0],
  });
  const modalTranslateX = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [plusLayout ? plusLayout.x + 28 - width / 2 : 0, 0],
  });

  const tabs = [
      {
        key: 'Home',
        icon: <Ionicons name="home-outline" size={24} color="#fff" />, // Home
        route: 'MainDashboard',
      },
      {
        key: 'SavedMeals',
        icon: <Ionicons name="fast-food-outline" size={24} color="#fff" />, // Saved Meals
        route: 'SavedMealsScreen',
      },
      {
        key: 'Plus',
        icon: <Ionicons name="add" size={32} color="#fff" />, // Center +
        route: null, // opens modal
      },
      {
        key: 'Stats',
        icon: <Ionicons name="bar-chart-outline" size={24} color="#fff" />, // Summary
        route: 'ProgressScreen', // changed from 'TargetSummaryScreen'
      },
      {
        key: 'Profile',
        icon: <Ionicons name="person-outline" size={24} color="#fff" />, // Profile
        route: 'Profile',
      },
    ];
    

  const handleLogFood = async (mealType, nutritionData) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user_id = session?.user?.id;
      if (!user_id) {
        Alert.alert('You must be logged in to log food.');
        return;
      }
      await createFoodLog({ ...nutritionData, meal_type: mealType, user_id });
      Alert.alert('Success', 'Food logged successfully!');
    } catch (e) {
      Alert.alert('Error', 'Failed to log food.');
    }
  };

  // Replace handlePhotoLog to open the options modal
  const handlePhotoLog = () => {
    setPhotoOptionsVisible(true);
  };

  // New: handle camera and gallery
  const handleTakePhoto = async () => {
    setPhotoOptionsVisible(false);
    navigation.navigate('CustomCameraScreen');
  };

  const handleChooseFromGallery = async () => {
    setPhotoOptionsVisible(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Gallery permission is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setModalVisible(false);
        navigation.navigate('PhotoCalorieScreen', { photoUri: result.assets[0].uri, mealType: 'Quick Log' });
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open gallery. ' + (e?.message || ''));
    }
  };
  const handleTextLog = () => {
    setModalVisible(false);
    navigation.navigate('QuickLogScreen', { mealType: 'Quick Log' });
  };
  const handleVoiceLog = () => {
    setModalVisible(false);
    navigation.navigate('VoiceCalorieScreen', { mealType: 'Quick Log' });
  };

  return (
    <>
      <View style={styles.container}>
        <LinearGradient
          colors={["#A084E8", "#7B61FF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBg}
        >
          <View style={styles.innerRow}>
            {tabs.map((tab, idx) => {
              if (tab.key === 'Plus') {
                return (
                  <Animated.View
                    key={tab.key}
                    style={{ transform: [{ scale: scaleAnim }] }}
                  >
                    <Pressable
                      ref={plusRef}
                      style={styles.plusBtn}
                      onPressIn={handlePlusPressIn}
                      onPressOut={handlePlusPressOut}
                      onLayout={handlePlusLayout}
                    >
                      {tab.icon}
                    </Pressable>
                  </Animated.View>
                );
              }
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={styles.tab}
                  onPress={() => tab.route && navigation.navigate(tab.route)}
                  activeOpacity={0.7}
                >
                  {tab.icon}
                </TouchableOpacity>
              );
            })}
          </View>
        </LinearGradient>
      </View>
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={handleModalClose}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.10)' }} onPress={handleModalClose} />
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              zIndex: 100,
              transform: [
                { translateY: modalAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) },
                { scale: modalScale },
              ],
              opacity: modalAnim,
            },
          ]}
        >
          <View style={{ backgroundColor: '#F6F8FA', borderRadius: 32, padding: 28, width: '90%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.10, shadowRadius: 18, elevation: 16 }}>
            <View style={{ width: 48, height: 6, borderRadius: 3, backgroundColor: '#E0E0E0', marginBottom: 18 }} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#222', marginBottom: 18, textAlign: 'center' }}>How would you like to log your meal?</Text>
            <View style={{ width: '100%', alignItems: 'center' }}>
              <TouchableOpacity onPress={handleTakePhoto}
               activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 24, paddingVertical: 18, paddingHorizontal: 24, marginBottom: 16, width: '100%', shadowColor: '#1abc9c', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }}>
                <Ionicons name="camera" size={28} color="#1abc9c" style={{ marginRight: 18 }} />
                <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#1abc9c' }}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleVoiceLog} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 24, paddingVertical: 18, paddingHorizontal: 24, marginBottom: 16, width: '100%', shadowColor: '#7B61FF', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }}>
                <Ionicons name="mic" size={28} color="#7B61FF" style={{ marginRight: 18 }} />
                <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#7B61FF' }}>Speak</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleTextLog} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 24, paddingVertical: 18, paddingHorizontal: 24, width: '100%', shadowColor: '#A084E8', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }}>
                <Ionicons name="pencil" size={28} color="#A084E8" style={{ marginRight: 18 }} />
                <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#A084E8' }}>Type</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handleModalClose} style={{ marginTop: 18, alignItems: 'center' }}>
              <Ionicons name="close-circle" size={32} color="#B0B0B0" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
      {/* New: Photo options modal */}
      <Modal
        visible={photoOptionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoOptionsVisible(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.20)' }} onPress={() => setPhotoOptionsVisible(false)} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', zIndex: 100 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '90%', alignItems: 'center', marginBottom: 32 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#222', marginBottom: 18, textAlign: 'center' }}>Add Photo</Text>
            <TouchableOpacity onPress={handleTakePhoto} style={{ width: '100%', paddingVertical: 16, alignItems: 'center', borderBottomWidth: 1, borderColor: '#eee' }}>
              <Text style={{ fontSize: 17, color: '#1abc9c', fontWeight: 'bold' }}>Take a Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleChooseFromGallery} style={{ width: '100%', paddingVertical: 16, alignItems: 'center', borderBottomWidth: 1, borderColor: '#eee' }}>
              <Text style={{ fontSize: 17, color: '#7B61FF', fontWeight: 'bold' }}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPhotoOptionsVisible(false)} style={{ width: '100%', paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 17, color: '#888', fontWeight: 'bold' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const VoiceLoggingModal = ({ visible, onClose, onLog, mealType }) => {
  const recordingRef = useRef(null);
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
  const [nutritionData, setNutritionData] = useState(null);
  const [transcribedText, setTranscribedText] = useState('');
  // Use environment variables directly (from eas.json in production)
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);

  React.useEffect(() => {
    if (!visible) {
      if (recordingRef.current) {
        recordingRef.current.unloadAsync();
        recordingRef.current = null;
      }
      setNutritionData(null);
      setTranscribedText('');
      setIsRecording(false);
      setIsLoading(false);
    }
  }, [visible]);

  const startRecording = async () => {
    try {
      const hasPerm = await ensureAudioPermission();
      if (!hasPerm) {
        Alert.alert('Permission Required', 'Microphone access is needed to record audio.');
        return;
      }
      if (recordingRef.current) {
        await recordingRef.current.unloadAsync();
        recordingRef.current = null;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setNutritionData(null);
      setTranscribedText('');
    } catch (err) {
      console.log('startRecording error (CalorieFooter):', err);
      Alert.alert("Recording Error", "Could not start recording.");
    }
  };
  const stopRecording = async () => {
    setIsRecording(false);
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (uri) handleVoiceToCalorie(uri);
    } catch (error) {
      // ignore
    }
  };
  const handleVoiceToCalorie = async (uri) => {
    setIsLoading(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
      const audioData = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const prompt = `Analyze the food items in this audio. Your response MUST be a single valid JSON object and nothing else. Do not include markdown formatting like \`\`\`json.

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
   - "I had a burger and fries" → extract "1 burger" and "1 fries"

5. 🚨 WRONG EXAMPLES (DO NOT DO THIS):
   - "200 grams of black beans" → "1 black beans" ❌ WRONG!
   - "150g chicken" → "1 chicken" ❌ WRONG!
   - "1 cup rice" → "1 rice" ❌ WRONG!

6. If no specific quantity is mentioned, assume quantity of 1 (e.g., "1 sandwich", "1 juice")

The JSON object must have this structure: 
{ "transcription": "The full text of what you heard", "items": [ { "name": "EXACT_QUANTITY + food item", "calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number> } ], "total": { "calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number> } }`;
      const result = await model.generateContent([prompt, { inlineData: { mimeType: 'audio/mp4', data: audioData } }]);
      const response = await result.response;
      let text = response.text();
      
      console.log('CalorieFooter - Raw AI response:', text);
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonString = jsonMatch[0];
        console.log('CalorieFooter - Extracted JSON:', jsonString);
        const data = JSON.parse(jsonString);
        if (!data.total || !Array.isArray(data.items) || !data.transcription) {
          throw new Error('Invalid JSON structure from API.');
        }
        setTranscribedText(data.transcription);
        const foodName = data.items.map(item => item.name).join(', ');
        const mergedData = { food_name: foodName, ...data.total };
        setNutritionData(mergedData);
      } else {
        throw new Error('Invalid JSON format from API. No JSON object found.');
      }
    } catch (error) {
      Alert.alert("AI Error", "Could not analyze the audio. " + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  const handleConfirmLog = () => {
    onLog(mealType, nutritionData);
    onClose();
  };
  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 28, alignItems: 'center', width: 320 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>{mealType} - Voice Log</Text>
          {!nutritionData && (
            <TouchableOpacity onPress={isRecording ? stopRecording : startRecording} style={{ marginBottom: 16 }}>
              <Ionicons name={isRecording ? "stop-circle" : "mic-circle"} size={64} color="#7B61FF" />
            </TouchableOpacity>
          )}
          {isRecording && <Text style={{ color: '#7B61FF', marginBottom: 8 }}>Recording...</Text>}
          {isLoading && <ActivityIndicator size={50} color="#7B61FF" />}
          {transcribedText && <Text style={{ color: '#888', marginBottom: 8 }}>You said: &apos;{transcribedText}&apos;</Text>}
          {nutritionData && !isLoading && (
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{nutritionData.food_name}</Text>
              <Text>Calories: {nutritionData.calories?.toFixed(0)}</Text>
              <Text>Protein: {nutritionData.protein?.toFixed(1)}g</Text>
              <Text>Carbs: {nutritionData.carbs?.toFixed(1)}g</Text>
              <Text>Fat: {nutritionData.fat?.toFixed(1)}g</Text>
              <TouchableOpacity onPress={handleConfirmLog} style={{ backgroundColor: '#7B61FF', borderRadius: 8, padding: 10, marginTop: 10 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add to {mealType}</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={onClose} style={{ marginTop: 8 }}>
            <Text style={{ color: '#7B61FF', fontWeight: 'bold' }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    alignItems: 'center',
    zIndex: 100,
  },
  gradientBg: {
    borderRadius: 40,
    width: 370,
    paddingHorizontal: 0,
    paddingVertical: 0,
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 24,
  },
  innerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 40,
    paddingHorizontal: 18,
    paddingVertical: 10,
    width: 370,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  plusBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7B61FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    marginTop: -28,
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalSheet: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 18,
    textAlign: 'center',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    width: '100%',
    shadowColor: '#7B61FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  optionIcon: {
    marginRight: 16,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
  },
  optionDesc: {
    fontSize: 13,
    color: '#888',
  },
  closeBtn: {
    backgroundColor: '#7B61FF',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 24,
    marginTop: 18,
  },
  closeBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});

export default CalorieFooter;