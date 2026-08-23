import { Feather, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useContext, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingContext } from '../context/OnboardingContext';
import { useTheme } from '../context/ThemeContext';

const APP_THEME = {
  primary: '#1F4E4A',
  primarySoft: '#2C6661',
  mint: '#A8D5CE',
  mintSoft: '#DCEFEB',
  background: '#F4FBFA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF7F5',
  border: '#D7EAE6',
  text: '#173A37',
  textSoft: '#5E7D78',
  textMuted: '#7F9B96',
  white: '#FFFFFF',
};

const workoutOptions = [
  { label: 'Strength', icon: 'dumbbell' },
  { label: 'Yoga / Flexibility', icon: 'yoga' },
  { label: 'HIIT & Functional', icon: 'fire' },
  { label: 'Running / Cardio', icon: 'run-fast' },
  { label: 'No Equipment / Home', icon: 'home' },
  { label: 'Sports & Games', icon: 'soccer' },
  { label: "I'm New to Working Out", icon: 'user-plus' },
  { label: 'Not Sure Yet', icon: 'help-outline' },
];

const dayOptions = [1, 2, 3, 4, 5, 6, 7];

const timeOptions = [
  { label: 'Morning', sub: '6 AM – 9 AM', icon: 'sunrise' },
  { label: 'Afternoon', sub: '12 PM – 3 PM', icon: 'sun' },
  { label: 'Evening', sub: '5 PM – 8 PM', icon: 'moon' },
  { label: 'Night', sub: 'After 8 PM', icon: 'moon' },
  { label: 'No Preference', sub: 'I go with the flow', icon: 'sunrise' },
];

const WorkoutPreferencesScreen = ({ navigation }) => {
  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  const { isDark } = useTheme();
  const [selectedWorkouts, setSelectedWorkouts] = useState([]);
  const [days, setDays] = useState(4);
  const [selectedTime, setSelectedTime] = useState([]);

  const toggleWorkout = (idx) => {
    setSelectedWorkouts((prev) =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const toggleTime = (idx) => {
    setSelectedTime((prev) =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const canContinue = selectedWorkouts.length > 0 && days > 0 && selectedTime.length > 0;

  const handleContinue = () => {
    setOnboardingData({
      ...onboardingData,
      prefered_workout: selectedWorkouts.map(idx => workoutOptions[idx].label),
      total_days_per_week: days,
      prefered_time: selectedTime.map(idx => timeOptions[idx].label),
    });
    navigation.navigate('GoalSummary');
  };

  const summary = [
    selectedWorkouts.map(idx => workoutOptions[idx].label).join(', ') || '—',
    `${days} Day${days > 1 ? 's' : ''}`,
    selectedTime.map(idx => timeOptions[idx].label).join(', ') || '—',
  ].join(' • ');

  const renderWorkoutIcon = (icon, color) => {
    if (icon === 'dumbbell') return <MaterialCommunityIcons name="dumbbell" size={22} color={color} />;
    if (icon === 'yoga') return <MaterialCommunityIcons name="yoga" size={22} color={color} />;
    if (icon === 'fire') return <MaterialCommunityIcons name="fire" size={22} color={color} />;
    if (icon === 'run-fast') return <MaterialCommunityIcons name="run-fast" size={22} color={color} />;
    if (icon === 'home') return <MaterialIcons name="home" size={22} color={color} />;
    if (icon === 'soccer') return <MaterialCommunityIcons name="soccer" size={22} color={color} />;
    if (icon === 'user-plus') return <Feather name="user-plus" size={22} color={color} />;
    return <MaterialIcons name="help-outline" size={22} color={color} />;
  };

  const renderTimeIcon = (icon, color) => {
    if (icon === 'sunrise') return <Feather name="sunrise" size={18} color={color} />;
    if (icon === 'sun') return <Feather name="sun" size={18} color={color} />;
    return <Feather name="moon" size={18} color={color} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={APP_THEME.primary} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarLabel}>SETUP</Text>
          <Text style={styles.topBarTitle}>Workout Preferences</Text>
        </View>

        <View style={{ width: 46 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>YOUR MOVEMENT PROFILE</Text>
          </View>

          <Text style={styles.heroTitle}>Build a routine that feels natural</Text>
          <Text style={styles.heroDescription}>
            Choose the workout styles you enjoy, how many days you want to move,
            and the time of day that suits your energy best.
          </Text>

          <View style={styles.summaryStrip}>
            <MaterialIcons name="insights" size={18} color={APP_THEME.primary} />
            <Text style={styles.summaryStripText}>{summary}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
  <View style={styles.sectionHeaderRow}>
    <Text style={styles.sectionEyebrow}>1</Text>
    <View style={styles.sectionHeaderTextWrap}>
      <Text style={styles.sectionTitle}>Workout styles</Text>
      <Text style={styles.sectionSub}>Pick one or more ways you like to train.</Text>
    </View>
  </View>

  <View style={styles.workoutGrid}>
    {workoutOptions.map((option, idx) => {
      const selected = selectedWorkouts.includes(idx);

      return (
        <TouchableOpacity
          key={option.label}
          style={[styles.workoutGridCard, selected && styles.workoutGridCardSelected]}
          onPress={() => toggleWorkout(idx)}
          activeOpacity={0.85}
        >
          <View style={[styles.workoutGridIconShell, selected && styles.workoutGridIconShellSelected]}>
            {renderWorkoutIcon(option.icon, selected ? APP_THEME.white : APP_THEME.primary)}
          </View>

          <Text style={[styles.workoutGridTitle, selected && styles.workoutGridTitleSelected]}>
            {option.label}
          </Text>

          {selected && (
            <View style={styles.workoutGridCheck}>
              <MaterialIcons name="check" size={14} color={APP_THEME.white} />
            </View>
          )}
        </TouchableOpacity>
      );
    })}
  </View>
</View>

        <View style={styles.sectionCard}>
  <View style={styles.sectionHeaderRow}>
    <Text style={styles.sectionEyebrow}>2</Text>
    <View style={styles.sectionHeaderTextWrap}>
      <Text style={styles.sectionTitle}>Weekly frequency</Text>
      <Text style={styles.sectionSub}>Choose how many days you want to stay active.</Text>
    </View>
  </View>

  <View style={styles.daysPanelCompact}>
    <View style={styles.daysGridSingleRow}>
      {dayOptions.map((d) => {
        const selected = days === d;
        return (
          <TouchableOpacity
            key={d}
            style={[styles.dayTileCompact, selected && styles.dayTileCompactSelected]}
            onPress={() => setDays(d)}
            activeOpacity={0.85}
          >
            <Text style={[styles.dayTileCompactNumber, selected && styles.dayTileCompactNumberSelected]}>
              {d}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>

    <Text style={styles.daysSubCompact}>
      You selected {days} day{days > 1 ? 's' : ''} each week.
    </Text>
  </View>
</View>

       <View style={styles.sectionCard}>
  <View style={styles.sectionHeaderRow}>
    <Text style={styles.sectionEyebrow}>3</Text>
    <View style={styles.sectionHeaderTextWrap}>
      <Text style={styles.sectionTitle}>Preferred time</Text>
      <Text style={styles.sectionSub}>Select the times when movement fits your day best.</Text>
    </View>
  </View>

  <View style={styles.timeGridTwoColumn}>
    {timeOptions.map((option, idx) => {
      const selected = selectedTime.includes(idx);
      const isLast = idx === 4;

      return (
        <TouchableOpacity
          key={option.label}
          style={[
            styles.timeGridCard,
            isLast && styles.timeGridCardFull,
            selected && styles.timeGridCardSelected,
          ]}
          onPress={() => toggleTime(idx)}
          activeOpacity={0.85}
        >
          <View style={[styles.timeGridIconShell, selected && styles.timeGridIconShellSelected]}>
            {renderTimeIcon(option.icon, selected ? APP_THEME.white : APP_THEME.primary)}
          </View>

          <View style={styles.timeGridTextWrap}>
            <Text style={[styles.timeGridLabel, selected && styles.timeGridLabelSelected]}>
              {option.label}
            </Text>
            <Text style={[styles.timeGridSub, selected && styles.timeGridSubSelected]}>
              {option.sub}
            </Text>
          </View>

          <View style={[styles.timeGridBadge, selected && styles.timeGridBadgeSelected]}>
            {selected ? (
              <MaterialIcons name="check" size={14} color={APP_THEME.white} />
            ) : (
              <Ionicons name="add" size={14} color={APP_THEME.primary} />
            )}
          </View>
        </TouchableOpacity>
      );
    })}
  </View>
</View>

        <View style={styles.finalCard}>
          <View style={styles.finalCardRow}>
            <View style={styles.finalIconWrap}>
              <MaterialCommunityIcons name="calendar-heart" size={22} color={APP_THEME.primary} />
            </View>
            <View style={styles.finalTextWrap}>
              <Text style={styles.finalTitle}>Your rhythm preview</Text>
              <Text style={styles.finalText}>{summary}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.ctaButton, !canContinue && styles.ctaButtonDisabled]}
          disabled={!canContinue}
          onPress={handleContinue}
          activeOpacity={0.88}
        >
          <View style={styles.ctaInner}>
            <Text style={[styles.ctaText, !canContinue && styles.ctaTextDisabled]}>
              {canContinue ? 'Set My Workout Rhythm' : 'Complete your preferences'}
            </Text>
            {canContinue && (
              <MaterialIcons name="arrow-forward" size={22} color={APP_THEME.white} />
            )}
          </View>
        </TouchableOpacity>

        <Text style={styles.footerSubtext}>You can change these choices later anytime.</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  workoutGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: 12,
},
workoutGridCard: {
  width: '48%',
  backgroundColor: APP_THEME.background,
  borderWidth: 1,
  borderColor: APP_THEME.border,
  borderRadius: 20,
  paddingVertical: 18,
  paddingHorizontal: 12,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 132,
  position: 'relative',
},
workoutGridCardSelected: {
  backgroundColor: APP_THEME.primary,
  borderColor: APP_THEME.primary,
},
workoutGridIconShell: {
  width: 46,
  height: 46,
  borderRadius: 15,
  backgroundColor: APP_THEME.mintSoft,
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 12,
},
workoutGridIconShellSelected: {
  backgroundColor: 'rgba(255,255,255,0.14)',
},
workoutGridTitle: {
  fontSize: 14,
  lineHeight: 18,
  color: APP_THEME.text,
  fontFamily: 'Lexend-Bold',
  textAlign: 'center',
},
workoutGridTitleSelected: {
  color: APP_THEME.white,
},
workoutGridCheck: {
  position: 'absolute',
  top: 10,
  right: 10,
  width: 22,
  height: 22,
  borderRadius: 11,
  backgroundColor: APP_THEME.mint,
  alignItems: 'center',
  justifyContent: 'center',
},

daysPanelCompact: {
  backgroundColor: APP_THEME.background,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: APP_THEME.border,
  paddingHorizontal: 12,
  paddingVertical: 14,
},
daysGridSingleRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
dayTileCompact: {
  width: 36,
  height: 44,
  borderRadius: 14,
  backgroundColor: APP_THEME.surface,
  borderWidth: 1,
  borderColor: APP_THEME.border,
  alignItems: 'center',
  justifyContent: 'center',
},
dayTileCompactSelected: {
  backgroundColor: APP_THEME.primary,
  borderColor: APP_THEME.primary,
},
dayTileCompactNumber: {
  fontSize: 14,
  color: APP_THEME.text,
  fontFamily: 'Lexend-Bold',
},
dayTileCompactNumberSelected: {
  color: APP_THEME.white,
},
daysSubCompact: {
  marginTop: 12,
  fontSize: 13,
  color: APP_THEME.textSoft,
  fontFamily: 'Manrope-Regular',
  textAlign: 'center',
},

timeGridTwoColumn: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: 12,
},
timeGridCard: {
  width: '48%',
  backgroundColor: APP_THEME.background,
  borderWidth: 1,
  borderColor: APP_THEME.border,
  borderRadius: 20,
  padding: 14,
  minHeight: 94,
  position: 'relative',
},
timeGridCardFull: {
  width: '100%',
},
timeGridCardSelected: {
  backgroundColor: APP_THEME.surfaceAlt,
  borderColor: APP_THEME.primary,
},
timeGridIconShell: {
  width: 38,
  height: 38,
  borderRadius: 12,
  backgroundColor: APP_THEME.mintSoft,
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 12,
},
timeGridIconShellSelected: {
  backgroundColor: APP_THEME.primary,
},
timeGridTextWrap: {
  paddingRight: 24,
},
timeGridLabel: {
  fontSize: 14,
  color: APP_THEME.text,
  fontFamily: 'Lexend-Bold',
  marginBottom: 3,
},
timeGridLabelSelected: {
  color: APP_THEME.primary,
},
timeGridSub: {
  fontSize: 12,
  lineHeight: 17,
  color: APP_THEME.textSoft,
  fontFamily: 'Manrope-Regular',
},
timeGridSubSelected: {
  color: APP_THEME.textSoft,
},
timeGridBadge: {
  position: 'absolute',
  top: 12,
  right: 12,
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: APP_THEME.surface,
  borderWidth: 1,
  borderColor: APP_THEME.border,
  alignItems: 'center',
  justifyContent: 'center',
},
timeGridBadgeSelected: {
  backgroundColor: APP_THEME.primary,
  borderColor: APP_THEME.primary,
},
  container: {
    flex: 1,
    backgroundColor: APP_THEME.background,
  },

  topBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: APP_THEME.surface,
    borderWidth: 1,
    borderColor: APP_THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  topBarLabel: {
    fontSize: 11,
    letterSpacing: 1.8,
    color: APP_THEME.textMuted,
    fontFamily: 'Manrope-Regular',
    marginBottom: 2,
  },
  topBarTitle: {
    fontSize: 20,
    color: APP_THEME.text,
    fontFamily: 'Lexend-Bold',
    textAlign: 'center',
  },
  stepBadge: {
    minWidth: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: APP_THEME.mintSoft,
    borderWidth: 1,
    borderColor: APP_THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  stepBadgeText: {
    fontSize: 13,
    color: APP_THEME.primary,
    fontFamily: 'Lexend-Bold',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 150,
  },

  heroCard: {
    backgroundColor: APP_THEME.primary,
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
    shadowColor: '#0E2523',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 14,
  },
  heroBadgeText: {
    fontSize: 11,
    color: APP_THEME.white,
    letterSpacing: 1.4,
    fontFamily: 'Lexend-Bold',
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 36,
    color: APP_THEME.white,
    fontFamily: 'Lexend-Bold',
    marginBottom: 10,
  },
  heroDescription: {
    fontSize: 15,
    lineHeight: 24,
    color: '#DCEFEB',
    fontFamily: 'Manrope-Regular',
    marginBottom: 18,
  },
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_THEME.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryStripText: {
    flex: 1,
    marginLeft: 10,
    color: APP_THEME.primary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Manrope-Regular',
  },

  sectionCard: {
    backgroundColor: APP_THEME.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: APP_THEME.border,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#10302D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sectionEyebrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: APP_THEME.mintSoft,
    color: APP_THEME.primary,
    textAlign: 'center',
    lineHeight: 30,
    fontFamily: 'Lexend-Bold',
    fontSize: 13,
    marginRight: 12,
  },
  sectionHeaderTextWrap: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    color: APP_THEME.text,
    fontFamily: 'Lexend-Bold',
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 14,
    color: APP_THEME.textSoft,
    fontFamily: 'Manrope-Regular',
    lineHeight: 20,
  },

  workoutList: {
    gap: 12,
  },
  workoutRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_THEME.background,
    borderWidth: 1,
    borderColor: APP_THEME.border,
    borderRadius: 20,
    padding: 14,
  },
  workoutRowCardSelected: {
    backgroundColor: APP_THEME.primary,
    borderColor: APP_THEME.primary,
  },
  workoutIconShell: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: APP_THEME.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  workoutIconShellSelected: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  workoutTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  workoutRowTitle: {
    fontSize: 15,
    color: APP_THEME.text,
    fontFamily: 'Lexend-Bold',
    marginBottom: 3,
  },
  workoutRowTitleSelected: {
    color: APP_THEME.white,
  },
  workoutRowMeta: {
    fontSize: 12,
    color: APP_THEME.textSoft,
    fontFamily: 'Manrope-Regular',
  },
  workoutRowMetaSelected: {
    color: '#D8ECE8',
  },
  selectionPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: APP_THEME.border,
    backgroundColor: APP_THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionPillSelected: {
    backgroundColor: APP_THEME.mint,
    borderColor: APP_THEME.mint,
  },
  selectionPillDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: APP_THEME.mint,
  },

  daysPanel: {
    backgroundColor: APP_THEME.background,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: APP_THEME.border,
    padding: 16,
  },
  daysHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  daysValue: {
    fontSize: 34,
    lineHeight: 36,
    color: APP_THEME.primary,
    fontFamily: 'Lexend-Bold',
    marginRight: 10,
  },
  daysValueLabel: {
    fontSize: 14,
    color: APP_THEME.textSoft,
    fontFamily: 'Manrope-Regular',
    marginBottom: 4,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  dayTile: {
    width: '12.5%',
    minWidth: 42,
    height: 52,
    borderRadius: 16,
    backgroundColor: APP_THEME.surface,
    borderWidth: 1,
    borderColor: APP_THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTileSelected: {
    backgroundColor: APP_THEME.primary,
    borderColor: APP_THEME.primary,
  },
  dayTileNumber: {
    fontSize: 16,
    color: APP_THEME.text,
    fontFamily: 'Lexend-Bold',
  },
  dayTileNumberSelected: {
    color: APP_THEME.white,
  },
  daysSub: {
    marginTop: 14,
    fontSize: 13,
    color: APP_THEME.textSoft,
    fontFamily: 'Manrope-Regular',
  },

  timeStack: {
    gap: 12,
  },
  timeRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_THEME.background,
    borderWidth: 1,
    borderColor: APP_THEME.border,
    borderRadius: 20,
    padding: 14,
  },
  timeRowCardSelected: {
    backgroundColor: APP_THEME.surfaceAlt,
    borderColor: APP_THEME.primary,
  },
  timeIconShell: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: APP_THEME.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  timeIconShellSelected: {
    backgroundColor: APP_THEME.primary,
  },
  timeInfo: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 15,
    color: APP_THEME.text,
    fontFamily: 'Lexend-Bold',
    marginBottom: 2,
  },
  timeLabelSelected: {
    color: APP_THEME.primary,
  },
  timeSub: {
    fontSize: 12,
    color: APP_THEME.textSoft,
    fontFamily: 'Manrope-Regular',
  },
  timeSubSelected: {
    color: APP_THEME.textSoft,
  },
  timeSelectBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: APP_THEME.surface,
    borderWidth: 1,
    borderColor: APP_THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSelectBadgeSelected: {
    backgroundColor: APP_THEME.primary,
    borderColor: APP_THEME.primary,
  },

  finalCard: {
    backgroundColor: APP_THEME.mintSoft,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: APP_THEME.border,
  },
  finalCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  finalIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: APP_THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  finalTextWrap: {
    flex: 1,
  },
  finalTitle: {
    fontSize: 15,
    color: APP_THEME.primary,
    fontFamily: 'Lexend-Bold',
    marginBottom: 4,
  },
  finalText: {
    fontSize: 13,
    lineHeight: 19,
    color: APP_THEME.text,
    fontFamily: 'Manrope-Regular',
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: APP_THEME.background,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: APP_THEME.border,
  },
  ctaButton: {
    backgroundColor: APP_THEME.primary,
    borderRadius: 20,
  },
  ctaButtonDisabled: {
    backgroundColor: '#DDE8E5',
  },
  ctaInner: {
    minHeight: 58,
    borderRadius: 20,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 16,
    color: APP_THEME.white,
    fontFamily: 'Lexend-Bold',
    marginRight: 8,
  },
  ctaTextDisabled: {
    color: APP_THEME.textMuted,
    marginRight: 0,
  },
  footerSubtext: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    color: APP_THEME.textMuted,
    fontFamily: 'Manrope-Regular',
  },
});

export default WorkoutPreferencesScreen;