import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingContext } from '../context/OnboardingContext';

const PRIMARY = '#000000';
const BACKGROUND = '#ffffff';
const GRAY_MEDIUM = '#e0e0e0';
const BLUE = '#1877F2';
const GREEN = '#1abc9c';
const YELLOW = '#ffe59e';
const RING = '#ffb84d';
const SLIDER_TRACK = '#ffb84d';
const SLIDER_THUMB = '#ffb84d';

const SpeedTargetScreen = ({ navigation }) => {
  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  const [weeklyRate, setWeeklyRate] = useState(0.5);
  const [tempRate, setTempRate] = useState(0.5); // Temporary state for smoother sliding
  const [unit, setUnit] = useState('kg');
  const [weightDiff, setWeightDiff] = useState(0);
  const [weeks, setWeeks] = useState(0);

  useEffect(() => {
    // Get data directly from context for consistency
    const current = onboardingData.weight ? Number(onboardingData.weight) : 0; // Stored in kg
    const target = onboardingData.target_weight ? Number(onboardingData.target_weight) : 0; // Stored in kg
    const selectedUnit = onboardingData.selectedWeightUnit || 'kg';
    
    setUnit(selectedUnit);

    let diff = Math.abs(target - current);
    
    // If the user wants to see lbs, convert the difference
    if (selectedUnit === 'lbs') {
      diff = diff * 2.20462;
    }
    
    setWeightDiff(diff);
  }, [onboardingData]);

  useEffect(() => {
    if (weeklyRate > 0) {
      setWeeks(weightDiff > 0 ? Math.ceil(weightDiff / weeklyRate) : 0);
    }
  }, [weeklyRate, weightDiff]);

  const handleContinue = (weeklyTarget) => {
    // Round to two decimal places to avoid floating-point precision issues
    const roundedWeeklyTarget = Math.round(weeklyTarget * 100) / 100;
    setOnboardingData({
      ...onboardingData,
      weekly_target: roundedWeeklyTarget,
    });
    navigation.navigate('TimePerDay');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <MaterialIcons name="arrow-back" size={28} color={PRIMARY} />
      </TouchableOpacity>
      <Text style={styles.header}>How fast do you want to go?</Text>
      <Text style={styles.subheader}>Set your weekly weight {unit === 'kg' ? 'loss' : 'change'} target</Text>
      <View style={styles.ringWrapper}>
        <View style={styles.ring}>
          <MaterialCommunityIcons name="fire" size={40} color={RING} style={{ marginBottom: 8 }} />
          <Text style={styles.ringValue}>{tempRate.toFixed(2)} {unit}</Text>
          <Text style={styles.ringLabel}>per week</Text>
        </View>
      </View>
      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>0.25 {unit}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0.25}
          maximumValue={1.5}
          step={0.05}
          value={tempRate}
          minimumTrackTintColor={SLIDER_TRACK}
          maximumTrackTintColor={GRAY_MEDIUM}
          thumbTintColor={SLIDER_THUMB}
          onValueChange={setTempRate}
          onSlidingComplete={(val) => setWeeklyRate(val)}
        />
        <Text style={styles.sliderLabel}>1.5 {unit}</Text>
      </View>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <MaterialIcons name="calendar-today" size={20} color={BLUE} style={{ marginRight: 8 }} />
          <Text style={styles.infoText}>You'll reach your goal in <Text style={styles.infoHighlight}>~{weeks} weeks</Text></Text>
        </View>
        <View style={styles.infoRow}>
          <MaterialIcons name="verified-user" size={20} color={GREEN} style={{ marginRight: 8 }} />
          <Text style={styles.infoText}><Text style={styles.infoGreen}>Healthy range: 0.5–1{unit} per week</Text></Text>
        </View>
        <Text style={styles.infoSubtext}>Sustainable weight {unit === 'kg' ? 'loss' : 'change'} for long-term results</Text>
      </View>
      <View style={styles.xpBadge}><Text style={styles.xpText}>⭐ +10 XP – Speed set!</Text></View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={() => handleContinue(weeklyRate)}>
          <Text style={styles.buttonText}>Confirm Target</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
    paddingTop: 16,
  },
  backButton: {
    position: 'absolute',
    top: 32,
    left: 16,
    zIndex: 2,
    backgroundColor: GRAY_MEDIUM,
    borderRadius: 20,
    padding: 4,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PRIMARY,
    marginTop: 104,
    marginBottom: 4,
    textAlign: 'center',
  },
  subheader: {
    fontSize: 16,
    color: '#888',
    marginBottom: 24,
    textAlign: 'center',
  },
  ringWrapper: {
    paddingTop: 30,
    alignItems: 'center',
    marginVertical: 16,
  },
  ring: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 10,
    borderColor: RING,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BACKGROUND,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  ringValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: PRIMARY,
    marginBottom: 2,
  },
  ringLabel: {
    fontSize: 16,
    color: '#888',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    alignSelf: 'center',
    marginVertical: 8,
  },
  slider: {
    flex: 1,
    marginHorizontal: 8,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#888',
    width: 48,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#f6f8fa',
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 24,
    marginTop: 18,
    marginBottom: 8,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 15,
    color: PRIMARY,
  },
  infoHighlight: {
    color: BLUE,
    fontWeight: 'bold',
  },
  infoGreen: {
    color: GREEN,
    fontWeight: 'bold',
  },
  infoSubtext: {
    fontSize: 13,
    color: '#888',
    marginTop: 6,
  },
  xpBadge: {
    backgroundColor: YELLOW,
    borderRadius: 12,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 10,
    marginBottom: 10,
  },
  xpText: {
    color: PRIMARY,
    fontWeight: 'bold',
    fontSize: 15,
  },
  buttonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    paddingHorizontal: 24,
    marginTop: 0,
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  button: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: BACKGROUND,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default SpeedTargetScreen;
