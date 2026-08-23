import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import 'react-native-url-polyfill/auto';
import supabase from '../lib/supabase';

// Configure Google Sign-In once when app starts
export const initializeGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: process.env.GOOGLE_WEB_CLIENT_ID, // Replace with your actual Web Client ID
    offlineAccess: false,
  });
};

// Main Google Sign-In function
export const handleGoogleSignIn = async () => {
  try {
    // Check for Play Services
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    
    // Sign in with Google
    const signInResult = await GoogleSignin.signIn();
    
    // Check if user cancelled (signInResult is null/undefined)
    if (!signInResult) {
      // User cancelled the sign-in - return silently
      return {
        success: false,
        message: 'Sign-in cancelled',
      };
    }
    
    // Extract idToken from either response format
    const idToken = signInResult?.data?.idToken || signInResult?.idToken;
    
    // If no idToken found, it's likely a cancellation (user closed the window)
    if (!idToken) {
      // User cancelled the sign-in - return silently without showing error
      return {
        success: false,
        message: 'Sign-in cancelled',
      };
    }

    console.log('✅ ID Token received from Google');

    // Sign in to Supabase with the Google ID token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    if (!data.user) {
      throw new Error('No user data received from Supabase');
    }

    console.log('✅ Successfully signed in:', data.user.email);
    
    // Return success response
    return {
      success: true,
      user: data.user,
      message: `Welcome ${data.user.user_metadata?.full_name || data.user.email}!`,
    };
    
  } catch (error) {
    // Handle specific error codes first
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      // User cancelled - return silently without error
      console.log('ℹ️ Google sign-in cancelled by user');
      return {
        success: false,
        message: 'Sign-in cancelled',
      };
    } else if (error.code === statusCodes.IN_PROGRESS) {
      return {
        success: false,
        message: 'Sign-in already in progress',
      };
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return {
        success: false,
        message: 'Play Services not available or outdated. Please update Google Play Services.',
      };
    }
    
    // Check if error message indicates cancellation
    const errorMessage = error.message || error.toString() || '';
    const lowerErrorMessage = errorMessage.toLowerCase();
    
    if (lowerErrorMessage.includes('cancel') || 
        lowerErrorMessage.includes('user_cancelled') ||
        lowerErrorMessage.includes('cancelled') ||
        error.code === 'SIGN_IN_CANCELLED' ||
        error.code === statusCodes.SIGN_IN_CANCELLED) {
      console.log('ℹ️ Google sign-in cancelled by user');
      return {
        success: false,
        message: 'Sign-in cancelled',
      };
    }
    
    // Only log and show error for actual errors, not cancellations
    console.error('Sign-in error:', error);
    
    return {
      success: false,
      message: errorMessage || 'Failed to sign in with Google. Please try again.',
    };
  }
};

// Sign out function
export const handleGoogleSignOut = async () => {
  try {
    await GoogleSignin.signOut();
    await supabase.auth.signOut();
    console.log('✅ Signed out successfully');
    return { success: true };
  } catch (error) {
    console.error('Sign-out error:', error);
    return {
      success: false,
      message: error.message || 'Failed to sign out',
    };
  }
};
