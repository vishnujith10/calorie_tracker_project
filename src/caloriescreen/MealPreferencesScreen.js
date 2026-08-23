import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useContext, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingContext } from '../context/OnboardingContext';

const COLORS = {
  primary: '#7B61FF',
  primaryLight: '#F3F0FF',
  text: '#18181B',
  secondary: '#4B5563',
  muted: '#9CA3AF',
  background: '#F9FAFB',
  card: '#FFFFFF',
  border: '#E5E7EB',
};
const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const RADIUS = { sm: 6, md: 12, lg: 24, xl: 32, full: 9999 };
const SHADOW = { md: { shadowColor: '#7B61FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 } };

const dietOptions = [
  'Vegetarian',
  'Vegan',
  'Keto',
  'Paleo',
  'Low-Carb',
  'Mediterranean',
  'No preferred diet',
];
const allergyOptions = [
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Egg-Free',
  'Soy-Free',
  'No allergies or restrictions',
];

const MealPreferencesScreen = () => {
  const navigation = useNavigation();
  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  const [selectedDiets, setSelectedDiets] = useState([]);
  const [selectedAllergies, setSelectedAllergies] = useState([]);

  // Diet selection logic
  const toggleDiet = (idx) => {
    if (idx === dietOptions.length - 1) {
      // 'No preferred diet' selected
      setSelectedDiets(selectedDiets.includes(idx) ? [] : [idx]);
    } else {
      let newSelected = selectedDiets.includes(idx)
        ? selectedDiets.filter(i => i !== idx)
        : [...selectedDiets.filter(i => i !== dietOptions.length - 1), idx];
      setSelectedDiets(newSelected);
    }
  };

  // Allergy selection logic
  const toggleAllergy = (idx) => {
    if (idx === allergyOptions.length - 1) {
      // 'No allergies or restrictions' selected
      setSelectedAllergies(selectedAllergies.includes(idx) ? [] : [idx]);
    } else {
      let newSelected = selectedAllergies.includes(idx)
        ? selectedAllergies.filter(i => i !== idx)
        : [...selectedAllergies.filter(i => i !== allergyOptions.length - 1), idx];
      setSelectedAllergies(newSelected);
    }
  };

  const canContinue = selectedDiets.length > 0 && selectedAllergies.length > 0;

  const handleContinue = () => {
    setOnboardingData({
      ...onboardingData,
      diet_preferences: selectedDiets.map(i => dietOptions[i]),
      allergies: selectedAllergies.map(i => allergyOptions[i]),
    });
    navigation.navigate('WeightGoal');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="close" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Meal Preferences</Text>
          <View style={{ width: 26 }} />
        </View>
        <Text style={styles.sectionTitle}>Do you follow a specific diet?</Text>
        <View style={styles.optionsGrid}>
          {dietOptions.map((option, idx) => (
            <TouchableOpacity
              key={option}
              style={[styles.optionPill, selectedDiets.includes(idx) && styles.optionPillSelected]}
              onPress={() => toggleDiet(idx)}
              activeOpacity={0.85}
            >
              <Text style={[styles.optionText, selectedDiets.includes(idx) && styles.optionTextSelected]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.sectionTitle}>Any allergies or restrictions?</Text>
        <View style={styles.optionsGrid}>
          {allergyOptions.map((option, idx) => (
            <TouchableOpacity
              key={option}
              style={[styles.optionPill, selectedAllergies.includes(idx) && styles.optionPillSelected]}
              onPress={() => toggleAllergy(idx)}
              activeOpacity={0.85}
            >
              <Text style={[styles.optionText, selectedAllergies.includes(idx) && styles.optionTextSelected]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          onPress={handleContinue}
          activeOpacity={canContinue ? 0.9 : 1}
          disabled={!canContinue}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.md, marginBottom: 8 },
  backBtn: { padding: SPACING.xs, borderRadius: RADIUS.md },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, fontFamily: 'Lexend-Bold', textAlign: 'center', flex: 1 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text, fontFamily: 'Lexend-Bold', marginTop: SPACING.md, marginBottom: 2, paddingHorizontal: SPACING.md },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10, paddingHorizontal: SPACING.md },
  optionPill: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, marginRight: SPACING.sm, marginBottom: SPACING.sm, backgroundColor: COLORS.card },
  optionPillSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionText: { color: COLORS.text, fontSize: 15, fontFamily: 'Manrope-Regular' },
  optionTextSelected: { color: '#fff', fontWeight: 'bold' },
  buttonContainer: { width: '100%', paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, backgroundColor: 'transparent' },
  continueBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, width: '100%', paddingVertical: SPACING.md, alignItems: 'center', marginBottom: SPACING.md },
  continueBtnDisabled: { backgroundColor: COLORS.muted },
  continueBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 17, fontFamily: 'Lexend-Bold' },
});

export default MealPreferencesScreen; 