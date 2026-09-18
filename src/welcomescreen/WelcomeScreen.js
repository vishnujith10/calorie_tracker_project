import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const WelcomeScreen = () => {
  const navigation = useNavigation();
  const { isDark } = useTheme();

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },

    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: Platform.OS === 'ios' ? 32 : 44,
      paddingHorizontal: 28,
    },

    // Single Square Logo Container + Badge
    cardWrapper: {
      position: 'relative',
      alignItems: 'center',
      marginBottom: 32,
    },

    // Single Square Logo Container
    logoContainer: {
      width: 170,
      height: 170,
      borderRadius: 38,
      backgroundColor: '#EAF8F6',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#DDF2EF',
      shadowColor: '#0D786A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 15,
      elevation: 4,
    },

    logoImage: {
      width: 130,
      height: 110,
      resizeMode: 'contain',
    },

    // Active Badge
    activeBadge: {
      position: 'absolute',
      bottom: -10,
      right: 4,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: '#D8ECE9',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 3,
    },

    activeDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#0D786A',
      marginRight: 6,
    },

    activeText: {
      fontFamily: 'Lexend-Medium',
      fontSize: 13,
      fontWeight: '600',
      color: '#163633',
    },

    // Title
    title: {
      marginTop: Math.round(SCREEN_HEIGHT * 0.08),
      fontFamily: 'Lexend-Bold',
      fontSize: 32,
      lineHeight: 40,
      fontWeight: '700',
      color: '#0D1F1C',
      textAlign: 'center',
      letterSpacing: -0.5,
    },

    // Description
    description: {
      marginTop: 14,
      maxWidth: 320,
      fontFamily: 'Lexend-Regular',
      fontSize: 15,
      lineHeight: 23,
      color: '#4A6662',
      textAlign: 'center',
    },

    // Bottom Container
    bottomSection: {
      width: '100%',
      paddingHorizontal: 28,
      paddingBottom: Platform.OS === 'ios' ? 24 : 28,
      alignItems: 'center',
    },

    // Primary Button ("Let's Go ->")
    letsGoButton: {
      width: '100%',
      height: 56,
      borderRadius: 28,
      backgroundColor: '#0D786A',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#0D786A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 4,
    },

    letsGoText: {
      fontFamily: 'Lexend-SemiBold',
      fontSize: 17,
      color: '#FFFFFF',
      marginRight: 8,
    },

    // Secondary Link ("New user? Register")
    secondaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16,
    },

    secondaryText: {
      fontFamily: 'Lexend-Regular',
      fontSize: 14,
      color: '#4A6662',
    },

    registerLink: {
      fontFamily: 'Lexend-SemiBold',
      fontSize: 14,
      fontWeight: '700',
      color: '#0D786A',
    },

    // Terms Footer
    termsText: {
      fontFamily: 'Lexend-Regular',
      fontSize: 12,
      lineHeight: 18,
      color: '#8CA39F',
      textAlign: 'center',
      marginTop: 18,
      maxWidth: 290,
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <StatusBar style="dark" />

      {/* Content */}
      <View style={dynamicStyles.content}>
        {/* Single Square Logo + Active Badge */}
        <View style={dynamicStyles.cardWrapper}>
          <View style={dynamicStyles.logoContainer}>
            <Image
              source={require('../../assets/logo/calora-logo.png')}
              style={dynamicStyles.logoImage}
            />
          </View>
          <View style={dynamicStyles.activeBadge}>
            <View style={dynamicStyles.activeDot} />
            <Text style={dynamicStyles.activeText}>Active</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={dynamicStyles.title}>Welcome to Calora</Text>

        {/* Subtitle */}
        <Text style={dynamicStyles.description}>
          Track meals effortlessly with AI-powered photo recognition and personalized
          nutrition insights.
        </Text>
      </View>

      {/* Bottom Section */}
      <View style={dynamicStyles.bottomSection}>
        {/* Let's Go Button */}
        <TouchableOpacity
          style={dynamicStyles.letsGoButton}
          onPress={() => navigation.navigate('MiniProfile')}
          activeOpacity={0.88}
        >
          <Text style={dynamicStyles.letsGoText}>Let's Go</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* New user? Register */}
        <View style={dynamicStyles.secondaryRow}>
          <Text style={dynamicStyles.secondaryText}>New user? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('MiniProfile')}>
            <Text style={dynamicStyles.registerLink}>Register</Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <Text style={dynamicStyles.termsText}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default WelcomeScreen; 