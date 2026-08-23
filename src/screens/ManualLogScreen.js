import { Ionicons } from '@expo/vector-icons';
import { GoogleGenerativeAI } from '@google/generative-ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import supabase from '../lib/supabase';

const ManualLogScreen = ({ route, navigation }) => {
  const { mealType } = route.params;
  const [foodQuery, setFoodQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [mealName, setMealName] = useState("");
  const [foodItems, setFoodItems] = useState([]); // [{name, qty, unit, kcal}]
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFood, setNewFood] = useState({ name: '', qty: '', unit: 'unit' });
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [entryMode, setEntryMode] = useState('itemized'); // 'itemized' or 'quick'
  const unitOptions = [
    { label: 'Unit', value: 'unit', icon: 'cube-outline' },
    { label: 'Kg', value: 'kg', icon: 'scale-outline' },
    { label: 'Gram', value: 'g', icon: 'fitness-outline' },
    { label: 'Liter', value: 'l', icon: 'water-outline' },
    { label: 'ML', value: 'ml', icon: 'beaker-outline' },
    { label: 'Piece', value: 'piece', icon: 'shapes-outline' },
    { label: 'Cup', value: 'cup', icon: 'cafe-outline' },
    { label: 'Tbsp', value: 'tbsp', icon: 'restaurant-outline' },
    { label: 'Tsp', value: 'tsp', icon: 'nutrition-outline' },
    { label: 'Dozen', value: 'dozen', icon: 'grid-outline' },
    { label: 'Pack', value: 'pack', icon: 'basket-outline' },
    { label: 'Bottle', value: 'bottle', icon: 'wine-outline' },
  ];

  // Use environment variables directly (from eas.json in production)
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);

  const handleTextToCalorie = async () => {
    if (!foodQuery.trim()) {
      Alert.alert("Input Required", "Please enter a food description.");
      return;
    }
    setIsLoading(true);
    setAnalysis(null);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `
        Analyze the food described in this text: "${foodQuery}".
        Your response MUST be a valid JSON object and nothing else.
        Do not include markdown formatting.
        The JSON object should have the following structure:
        {
          "dish_name": "A concise and appealing name for the dish",
          "description": "A one-sentence savory description of the dish.",
          "total_nutrition": { "calories": <number>, "protein": <number>, "fat": <number>, "carbs": <number>, "fiber": <number> },
          "ingredients": [ { "name": "EXACT_QUANTITY + ingredient name", "calories": <number> } ]
        }
        
        CRITICAL INSTRUCTIONS:
        1. The quantities provided (like "200g", "1 cup", "2 slices") are EXACT and must be used for calculations
        2. DO NOT convert to standard serving sizes - use the quantities as provided
        3. Calculate nutrition values proportionally based on the exact quantities:
           - If "200g black beans" is provided, and 100g typically has 20g carbs, then 200g = 40g carbs
           - If "1.5 cups rice" is provided, and 1 cup typically has 200 calories, then 1.5 cups = 300 calories
        4. Preserve the exact quantities in ingredient names (e.g., "200g black beans", not "1 black beans")
        
        IMPORTANT: Provide realistic fiber values based on the food type:
        - Fruits and vegetables: 2-8g fiber per serving
        - Whole grains and breads: 2-4g fiber per serving  
        - Legumes and beans: 5-15g fiber per serving
        - Nuts and seeds: 2-6g fiber per serving
        - Processed foods: 0-2g fiber per serving
        
        EXAMPLE: If user enters "200g black beans", calculate nutrition for exactly 200g, not for a standard serving size.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        setAnalysis(data);
      } else {
        throw new Error('Invalid JSON format from API.');
      }
    } catch (error) {
      console.error("Error analyzing text:", error);
      Alert.alert("AI Error", "Could not analyze the text. " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!analysis) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not logged in');
      const { total_nutrition, dish_name } = analysis;
      const logData = {
        user_id: user.id,
        food_name: dish_name,
        serving_size: 1, // or get from UI if available
        calories: total_nutrition.calories,
        carbs: total_nutrition.carbs,
        protein: total_nutrition.protein,
        fat: total_nutrition.fat,
        fiber: total_nutrition.fiber || 0,
        sugar: null,
        sodium: null,
        date_time: new Date().toISOString().split('T')[0],
        meal_type: mealType,
        notes: "",
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('user_food_logs').insert([logData]);
      if (error) throw error;

      // Optimistic cache update (Instagram pattern)
      const { updateMainDashboardCacheOptimistic, updateHomeScreenCacheOptimistic, updateMainDashboardStreakOptimistic } = require('../utils/cacheManager');
      updateMainDashboardCacheOptimistic(logData);
      updateHomeScreenCacheOptimistic(logData);
      updateMainDashboardStreakOptimistic(); // Trigger streak update

      Alert.alert('Success', 'Food logged successfully!');
      navigation.navigate('Home');
    } catch (error) {
      console.error('Error logging food:', error);
      Alert.alert('Error', 'Failed to log food. ' + error.message);
    }
  };

  // Shared analysis caching logic
  async function getCachedAnalysisForItems(foodItems) {
    const key = 'itemizedlog_cache_' + foodItems.map(i => `${i.qty} ${i.unit} ${i.name}`.toLowerCase()).join(',');
    const cached = await AsyncStorage.getItem(key);
    return cached ? JSON.parse(cached) : null;
  }
  async function setCachedAnalysisForItems(foodItems, data) {
    const key = 'itemizedlog_cache_' + foodItems.map(i => `${i.qty} ${i.unit} ${i.name}`.toLowerCase()).join(',');
    await AsyncStorage.setItem(key, JSON.stringify(data));
  }

  const handleAnalyzeMeal = async () => {
    const allowedMealNames = ['breakfast', 'lunch', 'dinner', 'snacks', 'supper'];
    if (!allowedMealNames.includes(mealName.trim().toLowerCase())) {
      Alert.alert(
        'Invalid Meal ',
        'Please enter a valid meal type.'
      );
      return;
    }

    if (!foodItems.length) {
      Alert.alert('No food items', 'Please add at least one food item.');
      return;
    }
    setIsLoading(true);
    try {
      // Check cache first
      const cached = await getCachedAnalysisForItems(foodItems);
      if (cached) {
        setAnalysis(cached);
        navigation.navigate('PostCalorieScreen', { analysis: cached, mealName });
        return;
      }
      // Build a prompt for the AI based on the foodItems array
      const foodList = foodItems.map(item => `${item.qty} ${item.unit} ${item.name}`).join(', ');
      console.log('ManualLogScreen - Food list being sent to AI:', foodList);
      
      const prompt = `Analyze the following meal with EXACT quantities: ${foodList}. Your response MUST be a valid JSON object and nothing else. Do not include markdown formatting. 

CRITICAL INSTRUCTIONS:
1. The quantities provided (like "200g", "1 cup", "2 slices") are EXACT and must be used for calculations
2. DO NOT convert to standard serving sizes - use the quantities as provided
3. Calculate nutrition values proportionally based on the exact quantities:
   - If "200g black beans" is provided, and 100g typically has 20g carbs, then 200g = 40g carbs
   - If "1.5 cups rice" is provided, and 1 cup typically has 200 calories, then 1.5 cups = 300 calories
4. Preserve the exact quantities in ingredient names (e.g., "200g black beans", not "1 black beans")

The JSON object should have this structure: 
{ 
  "dish_name": "A concise and appealing name for the dish", 
  "description": "A one-sentence savory description of the dish.", 
  "total_nutrition": { 
    "calories": <number>, 
    "protein": <number>, 
    "fat": <number>, 
    "carbs": <number>, 
    "fiber": <number> 
  }, 
  "ingredients": [ 
    { "name": "EXACT_QUANTITY + ingredient name", "calories": <number> } 
  ] 
}

IMPORTANT: Provide realistic fiber values based on the food type:
- Fruits and vegetables: 2-8g fiber per serving
- Whole grains and breads: 2-4g fiber per serving  
- Legumes and beans: 5-15g fiber per serving
- Nuts and seeds: 2-6g fiber per serving
- Processed foods: 0-2g fiber per serving

EXAMPLE: If user enters "200g black beans", calculate nutrition for exactly 200g, not for a standard serving size.`;
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        setAnalysis(data);
        await setCachedAnalysisForItems(foodItems, data);
        navigation.navigate('PostCalorieScreen', { analysis: data, mealName });
      } else {
        throw new Error('Invalid JSON format from AI.');
      }
    } catch (error) {
      Alert.alert('AI Error', 'Could not analyze the meal. ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showAddModal) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [showAddModal]);

  const selectedUnit = unitOptions.find(u => u.value === newFood.unit) || unitOptions[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 0 }}>
      <StatusBar style="auto" />
      {/* Header with Quick Log button */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#222' }}>Text to Calorie</Text>
        <TouchableOpacity
          style={{ backgroundColor: '#ECECFF', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 2, borderColor: '#6C63FF' }}
          onPress={() => navigation.navigate('QuickLogScreen')}
        >
          <Text style={{ color: '#6C63FF', fontWeight: 'bold', fontSize: 16 }}>Quick Log</Text>
        </TouchableOpacity>
      </View>
      {/* Itemized Entry Section (default UI) */}
      <SafeAreaView style={[styles.container, { paddingHorizontal: 0 }]}> {/* Remove double padding */}
        <View style={{ paddingHorizontal: 0 }}>
            {/* Meal Name Input */}
            <View style={styles.mealNameContainer}>
              <Text style={styles.mealNameLabel}>Name your meal</Text>
              <TextInput
                style={styles.mealNameInput}
                placeholder="e.g., Lunch "
                value={mealName}
                onChangeText={setMealName}
              />
            </View>

            {/* Food Items Table-like UI */}
            <View style={styles.foodTableContainer}>
  <View style={styles.foodTableHeader}>
    <View style={styles.colIcon} />
    <Text style={styles.colName}>Food Item</Text>
    <Text style={styles.colQty}>Qty</Text>
    <Text style={styles.colUnit}>Unit</Text>
    <Text style={styles.colKcal}>kcal</Text>
    <View style={styles.colEdit} />
  </View>

  {foodItems.map((item, idx) => (
    <View key={idx} style={styles.foodTableRow}>
      <View style={styles.colIcon}>
        <Ionicons name="fast-food-outline" size={18} color="#888" />
      </View>
      <Text style={styles.colName}>{item.name}</Text>
      <Text style={styles.colQty}>{item.qty}</Text>
      <Text style={styles.colUnit}>{item.unit}</Text>
      <Text style={styles.colKcal}>{item.kcal || ''}</Text>
      <TouchableOpacity onPress={() => {/* edit logic */}} style={styles.colEdit}>
        <Ionicons name="pencil-outline" size={18} color="#888" />
      </TouchableOpacity>
    </View>
  ))}
</View>
            {/* Add Food Modal */}
            <Modal visible={showAddModal} transparent animationType="fade">
              <View style={styles.modalOverlay}>
                <Animated.View
                  style={[
                    styles.modalContent,
                    {
                      transform: [{ scale: scaleAnim }],
                    },
                  ]}
                >
                  {/* Header */}
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Add Food Item</Text>
                    <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeButton}>
                      <Ionicons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                  </View>

                  {/* Food Name Input */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Food Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter food name"
                      value={newFood.name}
                      onChangeText={text => setNewFood({ ...newFood, name: text })}
                      placeholderTextColor="#999"
                    />
                  </View>

                  {/* Quantity and Unit Row */}
                  <View style={styles.quantityRow}>
                    <View style={[styles.inputContainerSmall, { flex: 1, marginRight: 12 }]}>
                      <Text style={styles.inputLabelSmall}>Quantity</Text>
                      <TextInput
                        style={styles.inputSmall}
                        placeholder="0"
                        keyboardType="numeric"
                        value={newFood.qty}
                        onChangeText={text => setNewFood({ ...newFood, qty: text })}
                        placeholderTextColor="#999"
                      />
                    </View>

                    <View style={[styles.inputContainerSmall, { flex: 1 }]}>
                      <Text style={styles.inputLabelSmall}>Unit</Text>
                      <TouchableOpacity
                        style={styles.unitSelector}
                        onPress={() => setShowUnitPicker(!showUnitPicker)}
                      >
                        <View style={styles.unitSelectorContent}>
                          <Ionicons name={selectedUnit.icon} size={20} color="#7B61FF" />
                          <Text style={styles.unitSelectorText}>{selectedUnit.label}</Text>
                        </View>
                        <Ionicons
                          name={showUnitPicker ? "chevron-up" : "chevron-down"}
                          size={20}
                          color="#666"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Unit Picker */}
                  {showUnitPicker && (
                    <View style={styles.unitPickerContainer}>
                      <ScrollView
                        style={styles.unitPicker}
                        showsVerticalScrollIndicator={false}
                      >
                        {unitOptions.map(unit => (
                          <TouchableOpacity
                            key={unit.value}
                            style={[
                              styles.unitOption,
                              newFood.unit === unit.value && styles.selectedUnitOption
                            ]}
                            onPress={() => {
                              setNewFood({ ...newFood, unit: unit.value });
                              setShowUnitPicker(false);
                            }}
                          >
                            <Ionicons
                              name={unit.icon}
                              size={18}
                              color={newFood.unit === unit.value ? '#7B61FF' : '#666'}
                            />
                            <Text style={[
                              styles.unitOptionText,
                              newFood.unit === unit.value && styles.selectedUnitOptionText
                            ]}>
                              {unit.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={() => setShowAddModal(false)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.addButton]}
                      onPress={() => {
                        setFoodItems([...foodItems, newFood]);
                        setShowAddModal(false);
                        setNewFood({ name: '', qty: '', unit: 'unit' });
                      }}
                    >
                      <Text style={styles.addButtonText}>Add Item</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </View>
            </Modal>
            {/* Add Another Item Button */}
            <TouchableOpacity style={styles.addAnotherItemButton} onPress={() => setShowAddModal(true)}>
              <Text style={styles.addAnotherItemText}>+ Add Another Item</Text>
            </TouchableOpacity>

            {/* Macro Split UI */}
            {analysis && (
              <View style={styles.macroSplitContainer}>
                <Text style={styles.macroSplitTitle}>Macro Split</Text>
                <View style={styles.macroSplitGrid}>
                  <MacroCard label="Protein" value={analysis.total_nutrition.protein} unit="g" color="#7B61FF" />
                  <MacroCard label="Carbs" value={analysis.total_nutrition.carbs} unit="g" color="#A259FF" />
                  <MacroCard label="Fat" value={analysis.total_nutrition.fat} unit="g" color="#F7B801" />
                  <MacroCard label="Fiber" value={6} unit="g" color="#43D9AD" />
                </View>
              </View>
            )}
          </View>

          {/* Footer Buttons (match QuickLogScreen style) */}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: '#6C63FF', borderRadius: 16, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }} onPress={handleAnalyzeMeal} disabled={isLoading}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18, marginRight: 8 }}>Analyze Meal</Text>
              <Ionicons name="arrow-forward" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
    </SafeAreaView>
  );
};

const NutritionCard = ({ icon, label, value }) => (
  <View style={styles.nutritionCard}>
    <View style={styles.nutritionCardHeader}>
      <Ionicons name={icon} size={20} color="#888" />
      <TouchableOpacity>
        <Ionicons name="pencil-outline" size={16} color="#aaa" />
      </TouchableOpacity>
    </View>
    <Text style={styles.nutritionLabel}>{label}</Text>
    <Text style={styles.nutritionValue}>{value}</Text>
  </View>
);

const MacroCard = ({ label, value, unit, color }) => (
  <View style={styles.macroCard}>
    <Text style={styles.macroCardLabel}>{label}</Text>
    <View style={styles.macroCardBarBg}>
      <View style={[styles.macroCardBar, { width: `${Math.min(value, 100)}%`, backgroundColor: color }]} />
    </View>
    <Text style={styles.macroCardValue}>{value}{unit}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  scrollContainer: { padding: 20 },
  inputContainer: { marginBottom: 20, },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    textAlignVertical: 'top'
  },
  analyzeButton: {
    backgroundColor: '#7B61FF',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10
  },
  analyzeButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  resultsContainer: { marginTop: 20 },
  description: { fontSize: 16, color: '#666', marginBottom: 8, textAlign: 'center' },
  dishName: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  nutritionCard: { width: '48%', backgroundColor: '#f8f9fa', borderRadius: 12, padding: 15, marginBottom: 10 },
  nutritionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  nutritionLabel: { fontSize: 14, color: '#666' },
  nutritionValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  ingredientsTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  ingredientsList: {},
  ingredientItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8, marginBottom: 8 },
  ingredientName: { flex: 1, fontSize: 16 },
  ingredientCalories: { fontSize: 16, color: '#666' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#eee' },
  doneButton: { backgroundColor: '#28a745', padding: 15, borderRadius: 12, alignItems: 'center' },
  doneButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  mealNameContainer: { marginBottom: 20 },
  mealNameLabel: { fontSize: 16, color: '#666', marginBottom: 8 },
  mealNameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  foodTableContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  
  foodTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#f1f1f1',
  },
  
  foodTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
    backgroundColor: '#fff',
  },
  
  colIcon: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  colName: {
    flex: 2,
    fontSize: 15,
    color: '#333',
    textAlign: 'left',
  },
  
  colQty: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
  },
  
  colUnit: {
    flex: 1.2,
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
  },
  
  colKcal: {
    flex: 1.2,
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
  },
  
  colEdit: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  

  addAnotherItemText: {
    color: '#5A67D8',
    fontSize: 15,
    fontWeight: '700',
  },
  macroSplitContainer: {
    marginTop: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
  },
  macroSplitTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  macroSplitGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  macroCard: {
    width: '45%', // Adjust as needed for two columns
    marginBottom: 15,
  },
  macroCardLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  macroCardBarBg: {
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  macroCardBar: {
    height: '100%',
    borderRadius: 5,
  },
  macroCardValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
    textAlign: 'center',
  },
  footerButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  analyzeMealButton: {
    backgroundColor: '#7B61FF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  analyzeMealButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logMealButton: {
    backgroundColor: '#28a745',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
  },
  logMealButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2D3748',
  },
  closeButton: {
    padding: 4,
  },
  inputContainerSmall: { marginBottom: 4, },
  inputLabelSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputSmall: {
    borderWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F9FAFB',
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
  },

  unitSelector: {
    borderWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    transform: [{ scale: 1 }],
  },

  unitSelectorActive: {
    backgroundColor: '#EEF2FF',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    transform: [{ scale: 1.02 }],
  },

  unitSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  unitSelectorText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
    flex: 1,
  },

  chevronContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '0deg' }],
  },

  chevronContainerActive: {
    backgroundColor: '#E5E7EB',
    transform: [{ rotate: '180deg' }],
  },

  unitPickerContainer: {
    marginBottom: 20,
    marginTop: 8,
  },

  unitPicker: {
    maxHeight: 200,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },

  unitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },

  lastUnitOption: {
    borderBottomWidth: 0,
  },

  selectedUnitOption: {
    backgroundColor: '#F0F9FF',
  },

  unitOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  selectedUnitOptionIcon: {
    backgroundColor: '#EEF2FF',
  },

  unitOptionText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    flex: 1,
  },

  selectedUnitOptionText: {
    color: '#6366F1',
    fontWeight: '600',
  },

  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },

  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  addButton: {
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },

  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addAnotherItemButton: {
    marginVertical: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
});

export default ManualLogScreen;