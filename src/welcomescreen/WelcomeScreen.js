import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const WelcomeScreen = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    logoWrap: {
      backgroundColor: isDark ? '#1A1A2E' : '#faf9f6',
      borderRadius: 40,
      padding: 32,
      marginBottom: 36,
      marginTop: 24,
      shadowColor: colors.shadow,
      shadowOpacity: isDark ? 0.3 : 0.04,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    welcomeTitle: {
      fontSize: 32,
      fontFamily: 'Lexend-Bold',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 18,
      marginTop: 8,
      letterSpacing: 0.2,
    },
    subtitle: {
      fontSize: 17,
      fontFamily: 'Manrope-Regular',
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 18,
      lineHeight: 24,
    },
    quote: {
      fontSize: 16,
      fontFamily: 'Manrope-Regular',
      color: colors.textMuted,
      fontStyle: 'italic',
      textAlign: 'center',
      marginBottom: 36,
    },
    ctaButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 18,
      paddingHorizontal: 32,
      alignItems: 'center',
      width: '100%',
      marginBottom: 14,
      shadowColor: colors.accent,
      shadowOpacity: isDark ? 0.3 : 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    ctaButtonText: {
      color: colors.textPrimary,
      fontSize: 18,
      fontFamily: 'Lexend-Bold',
      fontWeight: '600',
    },
    alreadyUserText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontFamily: 'Manrope-Regular',
      textDecorationLine: 'underline',
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <StatusBar style={isDark ? 'light' : 'auto'} />
      <KeyboardAvoidingView
        style={styles.flexGrow}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.contentWrap}>
          <View style={dynamicStyles.logoWrap}>
            <Image source={require('../../assets/logo/logo.png')} style={styles.logoImage} />
          </View>
          <Text style={dynamicStyles.welcomeTitle}>Welcome to Kalry</Text>
          <Text style={dynamicStyles.subtitle}>
            Your space to grow strong habits, gently — and with meaning.
          </Text>
          <Text style={dynamicStyles.quote}>
            "You don't need intensity. You need consistency."
          </Text>
        </View>
        <View style={styles.bottomArea}>
          <TouchableOpacity style={dynamicStyles.ctaButton} onPress={() => navigation.navigate('MiniProfile')}>
            <Text style={dynamicStyles.ctaButtonText}>Begin My Journey →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.alreadyUserBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={dynamicStyles.alreadyUserText}>Already a user?</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flexGrow: {
    flex: 1,
    justifyContent: 'space-between',
  },
  contentWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  logoImage: {
    width: 170,
    height: 170,
    resizeMode: 'contain',
  },
  bottomArea: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
    backgroundColor: 'transparent',
  },
  alreadyUserBtn: {
    alignItems: 'center',
    marginTop: 0,
  },
});

export default WelcomeScreen; 