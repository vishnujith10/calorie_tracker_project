import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useContext, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingContext } from '../context/OnboardingContext';

const PRIMARY = '#000000';
const SECONDARY = '#666666';
const BACKGROUND = '#ffffff';
const GRAY_LIGHT = '#f5f5f5';
const GRAY_MEDIUM = '#e0e0e0';
const ACCENT_GREEN = '#1abc9c';
const ACCENT_RED = '#e74c3c';
const ORANGE = '#ff8800';

const GoalScreen = ({ navigation }) => {
  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  
  // Use the same unit that was selected in ProfileScreen
  const [weightUnit, setWeightUnit] = useState(onboardingData.selectedWeightUnit || 'lbs');
  
  // Initialize current weight from stored data (always in kg, convert based on selected unit)
  const [currentWeight, setCurrentWeight] = useState(() => {
    const storedWeight = Number(onboardingData.weight) || 0;
    const selectedUnit = onboardingData.selectedWeightUnit || 'lbs';
    
    if (selectedUnit === 'lbs') {
      // Convert from kg to lbs for display
      const weightInLbs = (storedWeight * 2.20462).toFixed(1);
      return weightInLbs;
    } else {
      // Display in kg
      return storedWeight.toFixed(1);
    }
  });
  
  const [height] = useState(onboardingData.height ? String(onboardingData.height) : '');
  const [targetWeight, setTargetWeight] = useState('');
  const [healthyRange, setHealthyRange] = useState('');
  const [subtitle, setSubtitle] = useState('');

  useEffect(() => {
    if (height) {
      const heightInMeters = parseFloat(height) / 100; // height is stored in cm
      let minHealthy = 18.5 * heightInMeters * heightInMeters;
      let maxHealthy = 24.9 * heightInMeters * heightInMeters;
      
      if (weightUnit === 'lbs') {
        minHealthy = (minHealthy * 2.20462).toFixed(1);
        maxHealthy = (maxHealthy * 2.20462).toFixed(1);
        setHealthyRange(`${minHealthy} lbs - ${maxHealthy} lbs`);
      } else {
        setHealthyRange(`${minHealthy.toFixed(1)} kg - ${maxHealthy.toFixed(1)} kg`);
      }
    }
    
    let sub = 'Set a realistic goal for your ';
    if (onboardingData.goal_focus === 'Gain Muscle') {
      sub += 'weight gain journey';
    } else if (onboardingData.goal_focus === 'Stay Fit') {
      sub += 'maintenance journey';
    } else {
      sub += 'weight loss journey';
    }
    setSubtitle(sub);
  }, [height, onboardingData.goal_focus, weightUnit]);

  const handleContinue = () => {
    // Store target weight in kg for consistency
    let targetWeightInKg = targetWeight;
    if (weightUnit === 'lbs') {
      targetWeightInKg = (Number(targetWeight) / 2.20462).toFixed(1);
    }
    
    setOnboardingData({
      ...onboardingData,
      target_weight: targetWeightInKg,
      target_weight_unit: 'kg', // Always store in kg
    });
    navigation.navigate('SpeedTarget');
  };

  const handleUnitToggle = () => {
    if (weightUnit === 'lbs') {
      // Convert to kg
      setWeightUnit('kg');
      const currentWeightInKg = (Number(currentWeight) / 2.20462).toFixed(1);
      const targetWeightInKg = targetWeight ? (Number(targetWeight) / 2.20462).toFixed(1) : '';
      setCurrentWeight(currentWeightInKg);
      setTargetWeight(targetWeightInKg);
    } else {
      // Convert to lbs
      setWeightUnit('lbs');
      const currentWeightInLbs = (Number(currentWeight) * 2.20462).toFixed(1);
      const targetWeightInLbs = targetWeight ? (Number(targetWeight) * 2.20462).toFixed(1) : '';
      setCurrentWeight(currentWeightInLbs);
      setTargetWeight(targetWeightInLbs);
    }
  };

  const isValid = targetWeight && !isNaN(targetWeight) && Number(targetWeight) > 0;
  const weightDiff = isValid ? (Number(targetWeight) - Number(currentWeight)) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={28} color={PRIMARY} />
        </TouchableOpacity>
        <View style={styles.contentWrapper}>
          <View style={styles.spacer} />
          <Text style={[styles.header, { fontFamily: 'Lexend-Bold' }]}>What's your target weight?</Text>
          <Text style={[styles.subheader, { fontFamily: 'Manrope-Regular' }]}>{subtitle}</Text>
          <View style={styles.rowBetween}>
            <View style={styles.weightBlock}>
              <Text style={[styles.labelSmall, { fontFamily: 'Manrope-Regular' }]}>Current</Text>
              <Text style={[styles.currentWeight, { fontFamily: 'Lexend-Bold' }]}>{currentWeight} {weightUnit}</Text>
            </View>
            <Text style={styles.arrow}>{'>'}</Text>
            <View style={styles.weightBlock}>
              <Text style={[styles.labelSmall, { fontFamily: 'Manrope-Regular' }]}>Goal</Text>
              <Text style={[styles.goalWeight, { fontFamily: 'Lexend-Bold' }]}>{isValid ? targetWeight : '--'} {weightUnit}</Text>
            </View>
          </View>
          <Text style={[styles.weightDiff, { color: weightDiff < 0 ? ACCENT_GREEN : ACCENT_RED, fontFamily: 'Manrope-Regular' }]}> 
            {isValid ? (weightDiff > 0 ? '+' : '') + weightDiff.toFixed(1) + ' ' + weightUnit : `0 ${weightUnit}`}
          </Text>
          {/* <View style={styles.unitToggleWrapper}>
            <TouchableOpacity style={styles.unitToggle} onPress={handleUnitToggle}>
              <Text style={[styles.unitToggleText, weightUnit === 'kg' && styles.unitActive]}>kg</Text>
              <Text style={styles.unitToggleDivider}>⇄</Text>
              <Text style={[styles.unitToggleText, weightUnit === 'lbs' && styles.unitActive]}>lbs</Text>
            </TouchableOpacity>
          </View> */}
          <View style={styles.inputCard}>
            <View style={styles.inputLabelWrapper}>
              <Text style={[styles.inputLabel, { fontFamily: 'Manrope-Regular' }]}>Enter your target weight</Text>
            </View>
            <TextInput
              style={styles.targetInput}
              value={targetWeight === 0 || targetWeight === '' ? '' : String(targetWeight)}
              onChangeText={text => setTargetWeight(text === '' ? '' : text.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
              textAlign="center"
              maxLength={5}
            />
            <Text style={[styles.inputUnitBelow, { fontFamily: 'Manrope-Regular' }]}>{weightUnit}</Text>
          </View>
          {healthyRange ? (
            <Text style={[styles.healthyRange, { fontFamily: 'Manrope-Regular' }]}>Healthy weight range for your height: {healthyRange}</Text>
          ) : null}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, !isValid && styles.buttonDisabled]}
              disabled={!isValid}
              onPress={handleContinue}
            >
              <Text style={[styles.buttonText, { fontFamily: 'Lexend-Bold' }]}>Set Goal Weight</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 2,
    backgroundColor: GRAY_LIGHT,
    borderRadius: 20,
    padding: 4,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  spacer: {
    height: 32,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PRIMARY,
    marginTop: 60,
    marginBottom: 4,
    textAlign: 'center',
  },
  subheader: {
    fontSize: 16,
    color: SECONDARY,
    marginBottom: 28,
    textAlign: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  weightBlock: {
    alignItems: 'center',
  },
  labelSmall: {
    fontSize: 15,
    color: SECONDARY,
    marginBottom: 2,
  },
  currentWeight: {
    fontSize: 32,
    fontWeight: 'bold',
    color: PRIMARY,
  },
  goalWeight: {
    fontSize: 32,
    fontWeight: 'bold',
    color: PRIMARY,
  },
  arrow: {
    fontSize: 32,
    color: SECONDARY,
    marginHorizontal: 8,
  },
  weightDiff: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
    textAlign: 'center',
  },
  unitToggleWrapper: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 10,
  },
  unitToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GRAY_LIGHT,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  unitToggleText: {
    fontSize: 18,
    color: SECONDARY,
    fontWeight: 'bold',
  },
  unitActive: {
    color: ORANGE,
  },
  unitToggleDivider: {
    fontSize: 20,
    color: SECONDARY,
    marginHorizontal: 10,
  },
  inputCard: {
    width: '100%',
    backgroundColor: GRAY_LIGHT,
    borderRadius: 20,
    alignItems: 'center',
    marginVertical: 24,
    paddingVertical: 24,
    flexDirection: 'column',
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  inputLabelWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    color: SECONDARY,
    fontWeight: '500',
  },
  targetInput: {
    fontSize: 36,
    color: PRIMARY,
    fontWeight: 'bold',
    backgroundColor: 'transparent',
    borderWidth: 0,
    width: 120,
    height: 80,
    textAlign: 'center',
    marginBottom: 4,
  },
  inputUnitBelow: {
    fontSize: 20,
    color: SECONDARY,
    fontWeight: 'bold',
    marginTop: 2,
  },
  healthyRange: {
    color: SECONDARY,
    fontSize: 16,
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 24,
    marginTop: 'auto',
    marginBottom: 24,
  },
  button: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: BACKGROUND,
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    backgroundColor: GRAY_MEDIUM,
  },
});

export default GoalScreen;