import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const WelcomeScreen = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const dynamicStyles = StyleSheet.create({
    // ==========================================
    // MAIN CONTAINER
    // ==========================================

    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // ==========================================
    // MAIN CONTENT
    // ==========================================

    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },

    // ==========================================
    // LOGO
    // ==========================================

    logoContainer: {
      width: 180,
      height: 180,

      borderRadius: 40,

      overflow: 'hidden',

      backgroundColor: isDark
        ? '#1A1A2E'
        : '#EAF8F6',

      marginBottom: 38,

      shadowColor: colors.shadow,

      shadowOpacity: isDark
        ? 0.25
        : 0.06,

      shadowRadius: 15,

      shadowOffset: {
        width: 0,
        height: 5,
      },

      elevation: 3,
    },

    logo: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },

    // ==========================================
    // TITLE
    // ==========================================

    title: {
      fontFamily: 'Lexend-Bold',

      fontSize: 32,
      lineHeight: 40,

      color: colors.textPrimary,

      textAlign: 'center',

      letterSpacing: -0.5,
    },

    // ==========================================
    // DESCRIPTION
    // ==========================================

    description: {
      marginTop: 14,

      maxWidth: 330,

      fontFamily: 'Manrope-Regular',

      fontSize: 16,
      lineHeight: 24,

      color: colors.textSecondary,

      textAlign: 'center',
    },

    // ==========================================
    // BOTTOM SECTION
    // ==========================================

    bottom: {
      width: '100%',

      paddingHorizontal: 28,

      paddingBottom:
        Platform.OS === 'ios'
          ? 24
          : 28,
    },

    // ==========================================
    // GET STARTED TOUCH AREA
    // ==========================================

    buttonTouchArea: {
      width: '100%',
      height: 56,
    },

    // ==========================================
    // GLASS BUTTON
    // ==========================================

    button: {
      width: '100%',
      height: 56,

      borderRadius: 17,

      alignItems: 'center',
      justifyContent: 'center',

      /*
       * ONLY ONE BACKGROUND LAYER.
       *
       * No child View.
       * No highlight.
       * No ripple.
       * No inner rectangle.
       */

      backgroundColor: isDark
        ? 'rgba(45, 180, 160, 0.18)'
        : 'rgba(45, 180, 160, 0.16)',

      borderWidth: 1,

      borderColor: isDark
        ? 'rgba(100, 230, 210, 0.30)'
        : 'rgba(45, 170, 150, 0.28)',

      /*
       * No elevation.
       * This prevents Android from creating
       * additional rendering layers.
       */

      elevation: 0,

      shadowColor: 'transparent',

      shadowOpacity: 0,

      shadowRadius: 0,

      shadowOffset: {
        width: 0,
        height: 0,
      },
    },

    // ==========================================
    // BUTTON TEXT
    // ==========================================

    buttonText: {
      fontFamily: 'Lexend-Bold',

      fontSize: 16,

      color: isDark
        ? '#C8FFF5'
        : '#176B60',

      backgroundColor: 'transparent',
    },

    // ==========================================
    // LOGIN AREA
    // ==========================================

    loginButton: {
      height: 48,

      alignItems: 'center',
      justifyContent: 'center',

      marginTop: 6,
    },

    // Regular text
    loginText: {
      fontFamily: 'Manrope-Regular',

      fontSize: 14,

      color: '#222222',

      backgroundColor: 'transparent',
    },

    // ONLY "Sign in" is bold
    loginLink: {
      fontFamily: 'Manrope-Bold',

      fontSize: 14,

      fontWeight: '700',

      color: '#111111',

      textDecorationLine: 'underline',

      backgroundColor: 'transparent',
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>

      <StatusBar
        style={isDark ? 'light' : 'dark'}
      />

      {/* ========================================
          MAIN CONTENT
      ======================================== */}

      <View style={dynamicStyles.content}>

        {/* ======================================
            LOGO
        ====================================== */}

        <View style={dynamicStyles.logoContainer}>

          <Image
            source={require('../../assets/logo/calora-logo.png')}
            style={dynamicStyles.logo}
          />

        </View>

        {/* ======================================
            TITLE
        ====================================== */}

        <Text style={dynamicStyles.title}>
          Welcome to Calora
        </Text>

        {/* ======================================
            DESCRIPTION
        ====================================== */}

        <Text style={dynamicStyles.description}>
          A simple way to understand your health,
          build better habits, and stay consistent.
        </Text>

      </View>

      {/* ========================================
          BOTTOM SECTION
      ======================================== */}

      <View style={dynamicStyles.bottom}>

        {/* ======================================
            GET STARTED
        ====================================== */}

        <TouchableWithoutFeedback
          onPress={() => navigation.navigate('MiniProfile')}
        >

          <View style={dynamicStyles.buttonTouchArea}>

            <View style={dynamicStyles.button}>

              <Text style={dynamicStyles.buttonText}>
                Get Started
              </Text>

            </View>

          </View>

        </TouchableWithoutFeedback>

        {/* ======================================
            SIGN IN
        ====================================== */}

        <TouchableWithoutFeedback
          onPress={() => navigation.navigate('Login')}
        >

          <View style={dynamicStyles.loginButton}>

            <Text style={dynamicStyles.loginText}>
              Already have an account?{' '}
              <Text style={dynamicStyles.loginLink}>
                Sign in
              </Text>
            </Text>

          </View>

        </TouchableWithoutFeedback>

      </View>

    </SafeAreaView>
  );
};

export default WelcomeScreen;