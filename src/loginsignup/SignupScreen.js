import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingContext } from '../context/OnboardingContext';
import { useTheme } from '../context/ThemeContext';
import supabase from '../lib/supabase';
import calculateCalorieProfile from '../utils/calorieCalculator';
import { handleGoogleSignIn, initializeGoogleSignIn } from './googleSignInService';

const CARD_BG = '#FFFFFF';
const TEXT_PRIMARY = '#173A37';
const TEXT_SECONDARY = '#5E7D78';
const PRIMARY_TEAL = '#1F4E4A';
const APP_BG = '#F4FBFA';
const APP_BORDER = '#D7EAE6';

const SignupScreen = ({ navigation }) => {
  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);
  const [isGoogleSignup, setIsGoogleSignup] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      console.log('✅ SignupScreen focused - Initializing Google Sign-In');
      initializeGoogleSignIn();
      
      return () => {};
    }, [])
  );

  // ✅ Load Google user email if available
  useEffect(() => {
    if (global.googleUserData) {
      console.log('✅ Google user detected - Prefilling email');
      setEmail(global.googleUserData.email || '');
      setIsGoogleSignup(true);
    }
  }, []);

  useEffect(() => {
    supabase
      .from('user_profile')
      .select('*')
      .limit(1)
      .then(({ data, error }) => {
        console.log('Test select:', { data, error });
      });
  }, []);

  const handlePasswordChange = (text) => {
    setPassword(text);
    if (passwordError) {
      setPasswordError(false);
    }
  };

  const handleConfirmPasswordChange = (text) => {
    setConfirmPassword(text);
    if (confirmPasswordError) {
      setConfirmPasswordError(false);
    }
  };

  const handleSignup = async () => {
    setPasswordError(false);
    setConfirmPasswordError(false);

    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setPasswordError(true);
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError(true);
      Alert.alert('Password Mismatch', 'Passwords do not match. Please re-enter the correct password.');
      return;
    }

    try {
      setLoading(true);
      const cleanEmail = email.trim();
      console.log('Attempting signup with:', { email: cleanEmail });
      
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: 'kalry://login',
        },
      });

      console.log('Signup response:', { data, error });

      if (error) {
        if (error.message === 'User already registered') {
          Alert.alert(
            'Account Exists',
            'This email is already registered. Please try logging in instead.',
            [
              {
                text: 'Go to Login',
                onPress: () => navigation.navigate('Login'),
              },
              {
                text: 'Cancel',
                style: 'cancel',
              },
            ]
          );
        } else {
          Alert.alert('Signup Error', error.message);
        }
        return;
      }

      if (!data) {
        Alert.alert(
          'Signup Complete',
          'Your account was created! Please log in to continue.',
          [{ text: 'OK', onPress: () => navigation.replace('Login') }]
        );
        return;
      }

      if (data.user?.identities?.length === 0) {
        Alert.alert(
          'Check Your Email',
          'Please check your email for a confirmation link to complete your registration.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );
        return;
      }

      // If we get here, the user is confirmed
      if (data.user) {
        console.log('User created, signing in to establish session...');
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        });
        
        if (signInError) {
          console.error('Sign in failed after signup:', signInError);
          Alert.alert('Error', 'Account created but failed to establish session. Please try logging in manually.');
          return;
        }
        
        console.log('Successfully signed in, session established for profile creation');

        // ✅ Create profile with onboarding data
        const userProfile = {
          id: data.user.id,
          email: email,
          name: onboardingData?.name || 'User',
          age: onboardingData?.age ? Number(onboardingData.age) : null,
          gender: onboardingData?.gender || null,
          height: onboardingData?.heightCm ? parseFloat(onboardingData.heightCm) : null,
          weight: onboardingData?.weightKg ? parseFloat(onboardingData.weightKg) : null,
          social_refference: onboardingData?.social_refference || null,
          daily_activity_level: onboardingData?.daily_activity_level || 'moderate',
          goal_focus: onboardingData?.goal_focus || 'general_fitness',
          target_weight: onboardingData?.target_weight ? parseFloat(onboardingData.target_weight) : null,
          weekly_target: onboardingData?.weekly_target || null,
          spending_time: onboardingData?.spending_time || null,
          prefered_workout: onboardingData?.prefered_workout || null,
          total_days_per_week: onboardingData?.total_days_per_week ? Number(onboardingData.total_days_per_week) : 3,
          prefered_time: onboardingData?.prefered_time || null,
          weight_unit: onboardingData?.isMetric ? 'kg' : 'lbs',
          height_unit: onboardingData?.isMetric ? 'cm' : 'ft',
        };

        console.log('Attempting to insert profile for user:', data.user.id);
        
        const { error: profileError } = await supabase
          .from('user_profile')
          .insert([userProfile]);

        if (profileError) {
          console.error('Profile insert error:', profileError);
          Alert.alert('Warning', 'Account created but failed to save profile. Please contact support.');
        } else {
          // ✅ Calculate calorie profile if we have enough data
          if (onboardingData?.age && onboardingData?.gender && onboardingData?.weightKg && onboardingData?.heightCm) {
            try {
              const calorieData = calculateCalorieProfile({
                age: Number(onboardingData.age),
                gender: (onboardingData.gender || '').toLowerCase(),
                weight_kg: Number(onboardingData.weightKg),
                height_cm: Number(onboardingData.heightCm),
                activity_level: (onboardingData.daily_activity_level || 'moderate').toLowerCase(),
                goal_type: (onboardingData.goal_focus || 'maintain').toLowerCase().includes('lose') ? 'lose' : (onboardingData.goal_focus || 'maintain').toLowerCase().includes('gain') ? 'gain' : 'maintain',
              });
              
              await supabase.from('user_profile').update({
                bmr: calorieData.bmr,
                tdee: calorieData.tdee,
                calorie_goal: calorieData.calorie_goal,
                protein_g: calorieData.macro_targets.protein_g,
                fat_g: calorieData.macro_targets.fat_g,
                carbs_g: calorieData.macro_targets.carbs_g,
              }).eq('id', data.user.id);
              
              console.log('✅ Calorie profile created successfully');
            } catch (calorieError) {
              console.error('Calorie calculation error:', calorieError);
            }
          }
        }

        // ✅ Reset onboarding data and navigate to main dashboard
        setOnboardingData({});
        // ✅ Clear global Google data
        global.googleUserData = null;
        
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainDashboard' }],
        });
      }
    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert('Error', error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Google Sign-Up handler with onboarding data
  const onGoogleSignUpPress = async () => {
    setLoading(true);
    const result = await handleGoogleSignIn();
    
    if (result.success) {
      console.log('✅ Google Sign-In successful for signup');
      
      const { data: profile } = await supabase
        .from('user_profile')
        .select('*')
        .eq('id', result.user.id)
        .single();

      if (!profile) {
        console.log('Google OAuth: Creating profile for user:', result.user.id);
        
        // ✅ Use onboarding data + Google data
        const userProfile = {
          id: result.user.id,
          email: result.user.email,
          name: result.user.user_metadata?.full_name || result.user.email?.split('@')[0] || 'User',
          age: onboardingData?.age ? Number(onboardingData.age) : null,
          gender: onboardingData?.gender || null,
          height: onboardingData?.heightCm ? parseFloat(onboardingData.heightCm) : null,
          weight: onboardingData?.weightKg ? parseFloat(onboardingData.weightKg) : null,
          social_refference: onboardingData?.social_refference || null,
          daily_activity_level: onboardingData?.daily_activity_level || 'moderate',
          goal_focus: onboardingData?.goal_focus || 'general_fitness',
          target_weight: onboardingData?.target_weight ? parseFloat(onboardingData.target_weight) : null,
          weekly_target: onboardingData?.weekly_target || null,
          spending_time: onboardingData?.spending_time || null,
          prefered_workout: onboardingData?.prefered_workout || null,
          total_days_per_week: onboardingData?.total_days_per_week ? Number(onboardingData.total_days_per_week) : 3,
          prefered_time: onboardingData?.prefered_time || null,
          weight_unit: onboardingData?.isMetric ? 'kg' : 'lbs',
          height_unit: onboardingData?.isMetric ? 'cm' : 'ft',
        };
        
        const { error: insertError } = await supabase
          .from('user_profile')
          .insert([userProfile]);
        
        if (insertError) {
          console.error('Google OAuth: Profile creation error:', insertError);
          Alert.alert('Warning', 'Account created but failed to save profile. You can update it later.');
        } else {
          // ✅ Calculate calorie profile if we have enough data
          if (onboardingData?.age && onboardingData?.gender && onboardingData?.weightKg && onboardingData?.heightCm) {
            try {
              const calorieData = calculateCalorieProfile({
                age: Number(onboardingData.age),
                gender: (onboardingData.gender || '').toLowerCase(),
                weight_kg: Number(onboardingData.weightKg),
                height_cm: Number(onboardingData.heightCm),
                activity_level: (onboardingData.daily_activity_level || 'moderate').toLowerCase(),
                goal_type: (onboardingData.goal_focus || 'maintain').toLowerCase().includes('lose') ? 'lose' : (onboardingData.goal_focus || 'maintain').toLowerCase().includes('gain') ? 'gain' : 'maintain',
              });
              
              await supabase.from('user_profile').update({
                bmr: calorieData.bmr,
                tdee: calorieData.tdee,
                calorie_goal: calorieData.calorie_goal,
                protein_g: calorieData.macro_targets.protein_g,
                fat_g: calorieData.macro_targets.fat_g,
                carbs_g: calorieData.macro_targets.carbs_g,
              }).eq('id', result.user.id);
              
              console.log('✅ Calorie profile created for Google user');
            } catch (calorieError) {
              console.error('Calorie calculation error:', calorieError);
            }
          }
        }
      }
      
      // ✅ Reset onboarding data and navigate
      setOnboardingData({});
      // ✅ Clear global Google data
      global.googleUserData = null;
      
      setLoading(false);
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainDashboard' }],
      });
    } else {
      setLoading(false);
      if (result.message !== 'Sign-in cancelled') {
        Alert.alert('Error', result.message);
      }
    }
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : APP_BG,
    },
    subtitle: {
      fontSize: 11,
      color: isDark ? colors.textSecondary : TEXT_SECONDARY,
      fontFamily: 'Manrope-Regular',
      letterSpacing: 2,
      fontWeight: '600',
      marginBottom: 6,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: isDark ? colors.textPrimary : TEXT_PRIMARY,
      fontFamily: 'Lexend-Bold',
      letterSpacing: -0.5,
      marginBottom: 8,
      lineHeight: 34,
    },
    description: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : TEXT_SECONDARY,
      fontFamily: 'Manrope-Regular',
      lineHeight: 24,
      marginBottom: 32,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? colors.cardBackground : CARD_BG,
      borderRadius: 16,
      marginBottom: 16,
      paddingHorizontal: 16,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: isDark ? colors.border : APP_BORDER,
      shadowColor: 'rgba(31, 78, 74, 0.12)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    input: {
      flex: 1,
      height: 48,
      fontSize: 16,
      color: isDark ? colors.textPrimary : TEXT_PRIMARY,
      fontFamily: 'Manrope-Regular',
    },
    buttonActive: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      gap: 10,
      backgroundColor: PRIMARY_TEAL,
      borderRadius: 16,
    },
    buttonText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: 'Lexend-Bold',
      letterSpacing: 0.3,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: isDark ? colors.border : APP_BORDER,
    },
    dividerText: {
      marginHorizontal: 16,
      color: isDark ? colors.textSecondary : TEXT_SECONDARY,
      fontSize: 14,
      fontFamily: 'Manrope-Regular',
      fontWeight: '600',
    },
    socialButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: 'Lexend-Bold',
    },
    loginText: {
      color: isDark ? colors.textSecondary : TEXT_SECONDARY,
      fontFamily: 'Manrope-Regular',
    },
    loginLink: {
      color: PRIMARY_TEAL,
      fontWeight: '600',
      fontFamily: 'Manrope-Regular',
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'auto'} />
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} disabled={loading}>
          <View style={styles.backButtonCircle}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </View>
        </TouchableOpacity>
        <View style={{ width: 44 }} />
      </View>

      {/* ✅ Show info if Google signup */}
      {isGoogleSignup && (
        <View style={styles.googleInfoContainer}>
          <Text style={styles.googleInfoText}>
            ✓ Email confirmed via Google
          </Text>
        </View>
      )}

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <Text style={dynamicStyles.subtitle}>ALMOST DONE</Text>
            <Text style={dynamicStyles.title}>Create your{'\n'}account</Text>
            <Text style={dynamicStyles.description}>
              Complete your signup to start your fitness journey
            </Text>
          </View>
          <View style={styles.form}>
            <View style={dynamicStyles.inputContainer}>
              
              <TextInput
                style={dynamicStyles.input}
                placeholder="Email"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading && !isGoogleSignup}
              />
            </View>
            
            {/* ✅ Only show password field if NOT Google signup */}
            {!isGoogleSignup && (
              <>
                <View style={[dynamicStyles.inputContainer, passwordError && styles.inputContainerError]}>
                
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="Password"
                    placeholderTextColor={colors.textSecondary}
                    value={password}
                    onChangeText={handlePasswordChange}
                    secureTextEntry
                    editable={!loading}
                  />
                </View>
                {passwordError && (
                  <Text style={styles.errorText}>Password must be at least 6 characters long</Text>
                )}
                <View style={[dynamicStyles.inputContainer, confirmPasswordError && styles.inputContainerError]}>
                 
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor={colors.textSecondary}
                    value={confirmPassword}
                    onChangeText={handleConfirmPasswordChange}
                    secureTextEntry
                    editable={!loading}
                  />
                </View>
                {confirmPasswordError && (
                  <Text style={styles.errorText}>Passwords do not match</Text>
                )}
              </>
            )}

            <TouchableOpacity
              style={[styles.ctaButton, loading && styles.ctaButtonDisabled]}
              onPress={isGoogleSignup ? onGoogleSignUpPress : handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={styles.buttonDisabled}>
                  <Text style={styles.buttonTextDisabled}>
                    {isGoogleSignup ? 'Finalizing...' : 'Creating Account...'}
                  </Text>
                </View>
              ) : (
                <View style={dynamicStyles.buttonActive}>
                  <Text style={dynamicStyles.buttonText}>
                    {isGoogleSignup ? 'Complete Signup' : 'Create Account'}
                  </Text>
                  <MaterialIcons name="arrow-forward" size={22} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            {!isGoogleSignup && (
              <>
                <View style={styles.dividerContainer}>
                  <View style={dynamicStyles.dividerLine} />
                  <Text style={dynamicStyles.dividerText}>OR</Text>
                  <View style={dynamicStyles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={[styles.socialButton, loading && styles.buttonDisabled]}
                  onPress={onGoogleSignUpPress}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.cardBackground} />
                  ) : (
                    <>
                      <FontAwesome5 name="google" size={18} color="#FF9800" />
                      <Text style={dynamicStyles.socialButtonText}>Sign up with Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            <View style={styles.loginContainer}>
              <Text style={dynamicStyles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading}>
                <Text style={dynamicStyles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 20,
  },
  backButton: {
    zIndex: 10,
  },
  backButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: APP_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 20,
    fontFamily: 'Lexend-Bold',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  // ✅ NEW: Google info styles
  googleInfoContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  googleInfoText: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    color: '#10B981',
    backgroundColor: '#D1FAE5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 28,
  },
  subtitle: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    fontFamily: 'Manrope-Regular',
    letterSpacing: 2,
    fontWeight: '600',
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    fontFamily: 'Lexend-Bold',
    letterSpacing: -0.5,
    marginBottom: 8,
    lineHeight: 34,
  },
  description: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    fontFamily: 'Manrope-Regular',
    lineHeight: 24,
    marginBottom: 32,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: TEXT_PRIMARY,
    fontFamily: 'Manrope-Regular',
  },
  inputContainerError: {
    borderWidth: 2,
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 0.2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
  },
  ctaButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 24,
    shadowColor: PRIMARY_TEAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
    backgroundColor: PRIMARY_TEAL,
    borderRadius: 16,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Lexend-Bold',
    letterSpacing: 0.3,
  },
  ctaButtonDisabled: {
    opacity: 1,
  },
  buttonDisabled: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
  },
  buttonTextDisabled: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    fontFamily: 'Manrope-Regular',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: APP_BORDER,
  },
  dividerText: {
    marginHorizontal: 16,
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    fontWeight: '600',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_TEAL,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: PRIMARY_TEAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    gap: 10,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Lexend-Bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    color: TEXT_SECONDARY,
    fontFamily: 'Manrope-Regular',
  },
  loginLink: {
    color: PRIMARY_TEAL,
    fontWeight: '600',
    fontFamily: 'Manrope-Regular',
  },
});

export default SignupScreen;
