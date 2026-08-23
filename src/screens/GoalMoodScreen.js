import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useContext, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingContext } from '../context/OnboardingContext';

const COLORS = {
  primary: '#3B82F6',
  primaryHover: '#2563EB',
  primaryLight: '#DBEAFE',
  text: '#000',
  secondary: '#4B5563',
  muted: '#9CA3AF',
  placeholder: '#D1D5DB',
  background: '#FFF',
  surface: '#F9FAFB',
  card: '#FFF',
  border: '#E5E7EB',
  success: '#10B981',
  error: '#EF4444',
};
const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const RADIUS = { sm: 6, md: 12, lg: 24, xl: 32, full: 9999 };
const SHADOW = { md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 4 } };

const goalOptions = [
  'Build confidence',
  'Improve mental clarity',
  'Reduce stress',
  'Increase productivity',
  'Develop healthy habits',
  'Other',
];
const moodOptions = ['Calm', 'Hopeful', 'Neutral', 'Worried', 'Stressed'];

const GoalMoodScreen = () => {
  const navigation = useNavigation();
  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [selectedMood, setSelectedMood] = useState(null);
  const [notes, setNotes] = useState('');

  const toggleGoal = (idx) => {
    setSelectedGoals((prev) =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleContinue = () => {
    setOnboardingData({
      ...onboardingData,
      main_goals: selectedGoals.map(i => goalOptions[i]),
      mood: selectedMood !== null ? moodOptions[selectedMood] : null,
      mood_notes: notes,
    });
    navigation.navigate('MealPreferences');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="close" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Why are you here?</Text>
          <View style={{ width: 26 }} />
        </View>
        <Text style={styles.sectionTitle}>What's your main goal?</Text>
        <Text style={styles.sectionSub}>Select all that apply</Text>
        <View style={styles.goalList}>
          {goalOptions.map((goal, idx) => (
            <TouchableOpacity
              key={goal}
              style={styles.goalRow}
              onPress={() => toggleGoal(idx)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, selectedGoals.includes(idx) && styles.checkboxChecked]}>
                {selectedGoals.includes(idx) && <MaterialIcons name="check" size={18} color={COLORS.primary} />}
              </View>
              <Text style={styles.goalLabel}>{goal}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.sectionTitle}>How are you feeling today?</Text>
        <View style={styles.moodRow}>
          {moodOptions.map((mood, idx) => (
            <TouchableOpacity
              key={mood}
              style={[styles.moodPill, selectedMood === idx && styles.moodPillSelected]}
              onPress={() => setSelectedMood(idx)}
              activeOpacity={0.85}
            >
              <Text style={[styles.moodText, selectedMood === idx && styles.moodTextSelected]}>{mood}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.notesInput}
          placeholder=""
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
        />
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} activeOpacity={0.9}>
            <Text style={styles.continueBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, padding: 0, backgroundColor: COLORS.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.md, marginBottom: 8 },
  backBtn: { padding: SPACING.xs, borderRadius: RADIUS.md },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, fontFamily: 'Lexend-Bold', textAlign: 'center', flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, fontFamily: 'Lexend-Bold', marginTop: SPACING.md, marginBottom: 2, paddingHorizontal: SPACING.md },
  sectionSub: { fontSize: 14, color: COLORS.text, opacity: 0.7, marginBottom: 8, paddingHorizontal: SPACING.md, fontFamily: 'Manrope-Regular' },
  goalList: { marginBottom: 10, paddingHorizontal: SPACING.md },
  goalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  checkbox: { width: 24, height: 24, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: COLORS.primary, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm },
  checkboxChecked: { backgroundColor: '#fffbe6', borderColor: COLORS.primary },
  goalLabel: { fontSize: 16, color: COLORS.text, fontFamily: 'Manrope-Regular' },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', marginBottom: 12, paddingHorizontal: SPACING.md },
  moodPill: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, marginRight: SPACING.sm, marginBottom: SPACING.sm, backgroundColor: COLORS.surface },
  moodPillSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  moodText: { color: COLORS.text, fontSize: 15, fontFamily: 'Manrope-Regular' },
  moodTextSelected: { color: '#fff', fontWeight: 'bold' },
  notesInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: '#fff', minHeight: 80, fontSize: 15, fontFamily: 'Manrope-Regular', color: COLORS.text, marginHorizontal: SPACING.md, marginBottom: SPACING.md, padding: SPACING.md, textAlignVertical: 'top' },
  buttonContainer: { width: '100%', paddingHorizontal: SPACING.md, position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' },
  continueBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, width: '100%', paddingVertical: SPACING.md, alignItems: 'center', marginBottom: SPACING.md },
  continueBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 17, fontFamily: 'Lexend-Bold' },
});

export default GoalMoodScreen; 