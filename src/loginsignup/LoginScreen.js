import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { makeRedirectUri } from 'expo-auth-session';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
import saveUserProfile from '../utils/saveUserProfile';
import { handleGoogleSignIn, handleGoogleSignOut, initializeGoogleSignIn } from './googleSignInService';

const useProxy = true;
const redirectUri = makeRedirectUri({ useProxy });

const LoginScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const palette = useMemo(() => createPalette(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      console.log('✅ LoginScreen focused - Initializing Google Sign-In');
      initializeGoogleSignIn();
      
      // Handle Android hardware back button
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        navigation.navigate('Welcome');
        return true; // Prevent default behavior
      });
      
      return () => {
        backHandler.remove();
      };
    }, [navigation])
  );

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  const isGoogleSignInRef = React.useRef(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      const user = data.user;
      if (!user) {
        Alert.alert('Error', 'Login failed. Please try again.');
        setLoading(false);
        return;
      }

      navigation.replace('MainDashboard');
    } catch (error) {
      if (error.message && error.message.includes('Invalid login credentials')) {
        Alert.alert('Error', 'Invalid email or password');
      } else {
        Alert.alert('Error', error.message || 'Login failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ UPDATED: Google Sign-In with full onboarding validation & save
  const onGoogleSignInPress = async () => {
    setLoading(true);
    isGoogleSignInRef.current = true;
    
    try {
      await handleGoogleSignOut();
      console.log('✅ Forcing account picker...');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const result = await handleGoogleSignIn();
      
      if (!result.success) {
        setLoading(false);
        isGoogleSignInRef.current = false;
        
        // Handle cancellation silently - user pressed back
        if (result.message === 'Sign-in cancelled' || result.message?.includes('cancelled')) {
          console.log('ℹ️ Google sign-in cancelled by user');
          return;
        }
        
        Alert.alert('Error', result.message || 'Failed to sign in with Google');
        return;
      }

      console.log('✅ Google Sign-In successful for LoginScreen, User ID:', result.user.id);
      
      // Check if user has an existing registered profile
      const { data: profile } = await supabase
        .from('user_profile')
        .select('id, name, age, weight')
        .eq('id', result.user.id)
        .maybeSingle();

      let existingProfile = profile;
      if (!existingProfile && result.user.email) {
        const { data: profileByEmail } = await supabase
          .from('user_profile')
          .select('id, name, age, weight')
          .eq('email', result.user.email)
          .maybeSingle();
        if (profileByEmail) {
          existingProfile = profileByEmail;
        }
      }

      console.log('Profile check - age:', existingProfile?.age, 'weight:', existingProfile?.weight);

      // ✅ CASE 1: ALREADY FULLY REGISTERED USER
      if (existingProfile && existingProfile.name && existingProfile.age && existingProfile.weight) {
        console.log('✅ EXISTING REGISTERED USER - Going to MainDashboard');
        setLoading(false);
        navigation.replace('MainDashboard');
        isGoogleSignInRef.current = false;
        return;
      }

      // ✅ CASE 2: USER JUST COMPLETED ONBOARDING AND TAPPED GOOGLE LOGIN
      // Check if there is valid pending onboarding data in memory or storage
      let pendingData = { ...(onboardingData || {}) };
      try {
        const storedStr = await AsyncStorage.getItem('calora_onboarding_data');
        if (storedStr) {
          pendingData = { ...JSON.parse(storedStr), ...pendingData };
        }
      } catch (e) {
        console.warn('Error reading stored onboarding data:', e);
      }

      const hasOnboardingDetails = 
        (pendingData.age || pendingData.parsedAge) &&
        (pendingData.weight || pendingData.weightKg || pendingData.weightLbs);

      if (hasOnboardingDetails) {
        console.log('✅ Pending onboarding data found! Saving profile for new Google user...');
        const displayName = result.user.user_metadata?.full_name || result.user.email?.split('@')[0] || 'User';
        const saved = await saveUserProfile(result.user.id, result.user.email, displayName, pendingData);
        
        // Populate context with saved profile for MainDashboard
        setOnboardingData(prev => ({ ...prev, ...saved }));

        setLoading(false);
        isGoogleSignInRef.current = false;
        navigation.replace('MainDashboard');
        return;
      }

      // ⚠️ CASE 3: UNREGISTERED USER WITH NO ONBOARDING DATA
      console.log('⚠️ UNREGISTERED USER - Signing out and showing registration prompt');
      await handleGoogleSignOut();
      setLoading(false);
      isGoogleSignInRef.current = false;

      Alert.alert(
        'Account Not Registered',
        'This Google account is not registered. Please complete onboarding and register first.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Get Started',
            onPress: () => {
              navigation.navigate('MiniProfile');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Google Sign-In error:', error);
      setLoading(false);
      isGoogleSignInRef.current = false;
      Alert.alert('Error', error.message || 'An unexpected error occurred during Google Sign-In');
    }
  };

  const handleAppleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUri,
        }
      });
      
      if (error) throw error;
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Welcome')}
            disabled={loading}
          >
            <Ionicons name="chevron-back" size={28} color={palette.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Sign in to continue your fitness journey
          </Text>
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <MaterialIcons name="email" size={24} color={palette.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={palette.placeholder}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={24} color={palette.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={palette.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>
            <TouchableOpacity style={styles.forgotPassword} disabled={loading}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Signing in...' : 'SIGN IN'}
              </Text>
            </TouchableOpacity>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
            <TouchableOpacity
              style={[styles.socialButton, styles.button, loading && styles.buttonDisabled]}
              onPress={handleAppleLogin}
              disabled={loading}
            >
              <FontAwesome5 name="apple" size={20} color={palette.buttonText} />
              <Text style={styles.socialButtonText}>CONNECT WITH APPLE</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.socialButton, styles.button, loading && styles.buttonDisabled]}
              onPress={onGoogleSignInPress}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={palette.buttonText} />
              ) : (
                <>
                  <View style={styles.googleIconBorder}>
                    <FontAwesome5 name="google" size={20} color="#FF9800" />
                  </View>
                  <Text style={styles.socialButtonText}>CONNECT WITH GOOGLE</Text>
                </>
              )}
            </TouchableOpacity>
            
            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Don&apos;t have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')} disabled={loading}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createPalette = (themeColors, isDark) => ({
  background: isDark ? themeColors.background : '#F4FBFA',
  textPrimary: isDark ? themeColors.textPrimary : '#173A37',
  textSecondary: isDark ? themeColors.textSecondary : '#5E7D78',
  border: isDark ? themeColors.border : '#D7EAE6',
  primary: '#1F4E4A',
  cardBackground: isDark ? themeColors.cardBackground : '#FFFFFF',
  inputBackground: isDark ? themeColors.cardBackground : '#FFFFFF',
  placeholder: isDark ? '#A0AEC0' : '#7F9B96',
  buttonText: '#FFFFFF',
  googleBorder: isDark ? themeColors.textPrimary : '#1F4E4A',
  backButtonBg: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
});

const createStyles = (palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    padding: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: palette.backButtonBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: palette.textPrimary,
    fontFamily: 'Lexend-Bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: palette.textSecondary,
    fontFamily: 'Manrope-Regular',
    marginBottom: 32,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.inputBackground,
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 16,
    color: palette.textPrimary,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: palette.primary,
    fontSize: 14,
  },
  button: {
    backgroundColor: palette.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonText: {
    color: palette.buttonText,
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
  },
  dividerText: {
    marginHorizontal: 16,
    color: palette.textSecondary,
  },
  socialButton: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  socialButtonText: {
    color: palette.buttonText,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  googleIconBorder: {
    borderWidth: 1,
    borderColor: palette.googleBorder,
    borderRadius: 12,
    padding: 4,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupText: {
    color: palette.textSecondary,
  },
  signupLink: {
    color: palette.primary,
    fontWeight: 'bold',
  },
});

export default LoginScreen;
