import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { makeRedirectUri } from 'expo-auth-session';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
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
import { useTheme } from '../context/ThemeContext';
import supabase from '../lib/supabase';
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

  // Track if we're handling Google sign-in to prevent duplicate navigation
  const isGoogleSignInRef = React.useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only navigate if it's NOT a Google sign-in (Google sign-in handles its own navigation)
      // Also check if email is empty (meaning it's not a regular email/password login)
      if (event === 'SIGNED_IN' && session && !email && !isGoogleSignInRef.current) {
        navigation.replace('MainDashboard');
      }
      // Don't reset the flag here - let the Google sign-in handler reset it after navigation
    });
    return () => {
      subscription?.unsubscribe();
    };
  }, [email, navigation]);

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

  // ✅ UPDATED: Google Sign-In with reset to prevent back button
  const onGoogleSignInPress = async () => {
    setLoading(true);
    // Set flag to prevent onAuthStateChange from navigating
    isGoogleSignInRef.current = true;
    
    try {
      await handleGoogleSignOut();
      console.log('✅ Forcing account picker...');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const result = await handleGoogleSignIn();
      
      if (!result.success) {
        setLoading(false);
        isGoogleSignInRef.current = false; // Reset flag on failure
        
        // Handle cancellation silently - user just pressed back, no error needed
        if (result.message === 'Sign-in cancelled' || result.message?.includes('cancelled')) {
          console.log('ℹ️ Google sign-in cancelled by user');
          return; // Silently return, no error shown
        }
        
        // Show alert for other errors
        Alert.alert('Error', result.message || 'Failed to sign in with Google');
        return;
      }

      console.log('✅ Google Sign-In successful');
      console.log('User ID:', result.user.id);
      
      const { data: profile } = await supabase
        .from('user_profile')
        .select('id, name, age')
        .eq('id', result.user.id)
        .single();

      console.log('Profile check - exists:', !!profile);

      setLoading(false);

      // ✅ EXISTING USER - Go to MainDashboard
      if (profile && profile.name && profile.age) {
        console.log('✅ EXISTING USER - Going to MainDashboard');
        // Small delay to ensure auth state change is processed first
        setTimeout(() => {
        navigation.replace('MainDashboard');
          // Reset flag after navigation
          setTimeout(() => {
            isGoogleSignInRef.current = false;
          }, 500);
        }, 100);
      } 
      // ✅ NEW USER - Use reset to prevent back navigation
      else {
        console.log('⚠️ NEW USER - Starting onboarding (no back button)');
        
        global.googleUserData = result.user;
        
        // ✅ Use reset to clear navigation stack
        navigation.reset({
          index: 0,
          routes: [{ name: 'MiniProfile' }],
        });
        // Reset flag after navigation
        setTimeout(() => {
          isGoogleSignInRef.current = false;
        }, 500);
      }
    } catch (error) {
      console.error('Google Sign-In error:', error);
      setLoading(false);
      isGoogleSignInRef.current = false; // Reset flag on error
      
      // Check if error is a cancellation
      const errorMessage = error?.message || error?.toString() || '';
      if (errorMessage.includes('cancelled') || errorMessage.includes('cancel')) {
        console.log('ℹ️ Google sign-in cancelled by user');
        return; // Silently return, no error shown
      }
      
      // Show alert for actual errors
      Alert.alert('Error', errorMessage || 'Failed to sign in with Google');
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
