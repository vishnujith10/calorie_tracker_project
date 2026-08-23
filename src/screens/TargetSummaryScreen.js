import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY = '#000000';
const BACKGROUND = '#ffffff';
const GRAY_MEDIUM = '#e0e0e0';
const HIGHLIGHT = '#e6a15c';

const TargetSummaryScreen = ({ navigation }) => {
  const [weightDiff, setWeightDiff] = useState(0);
  const [unit, setUnit] = useState('kg');
  const [direction, setDirection] = useState('Gaining');

  useEffect(() => {
    const loadData = async () => {
      const data = await AsyncStorage.getItem('onboardingData');
      if (data) {
        const parsed = JSON.parse(data);
        const current = parsed.profile && parsed.profile.weight ? Number(parsed.profile.weight) : 0;
        const target = parsed.targetWeight ? Number(parsed.targetWeight) : 0;
        const unit = parsed.weightUnit || (parsed.profile && parsed.profile.weightUnit) || 'kg';
        setUnit(unit);
        const diff = target - current;
        setWeightDiff(Math.abs(diff).toFixed(1));
        setDirection(diff >= 0 ? 'Gaining' : 'Losing');
      }
    };
    loadData();
  }, []);

  const handleNext = async () => {
    const data = await AsyncStorage.getItem('onboardingData');
    const parsed = data ? JSON.parse(data) : {};
    parsed.goalType = direction;
    parsed.targetAmount = weightDiff;
    parsed.targetUnit = unit;
    await AsyncStorage.setItem('onboardingData', JSON.stringify(parsed));
    navigation.navigate('SpeedTarget');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <MaterialIcons name="arrow-back" size={28} color={PRIMARY} />
      </TouchableOpacity>
      <View style={styles.contentWrapper}>
        <Text style={styles.title}>
          {direction} <Text style={styles.highlight}>{weightDiff} {unit}</Text> is a realistic target. it's not hard at all!
        </Text>
        <Text style={styles.subtitle}>
          You're on your way to a healthier, stronger you. Stay consistent and see the results!
        </Text>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>Next</Text>
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
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: PRIMARY,
    textAlign: 'center',
    marginBottom: 24,
  },
  highlight: {
    color: HIGHLIGHT,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 19,
    color: PRIMARY,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  button: {
    backgroundColor: PRIMARY,
    borderRadius: 24,
    paddingVertical: 18,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: BACKGROUND,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
});

export default TargetSummaryScreen; 