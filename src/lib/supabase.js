import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Use environment variables directly (from eas.json in production)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl || 'https://tkuyjtdycmmkvunurlxj.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrdXlqdGR5Y21ta3Z1bnVybHhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzIwMDYsImV4cCI6MjA4OTQwODAwNn0.Vs1fjhWuGK93s2vbe3mcj-nLQaCcKXGVQW3LjnpD2VY';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, // Use AsyncStorage for persistent auth
    autoRefreshToken: true, // Automatically refresh tokens
    persistSession: true, // Persist session across app restarts
    detectSessionInUrl: false, // Don't detect session in URL (for mobile)
  },
});

// Enhanced session management with "Remember Me" functionality
// Optimized for network issues (like Expo tunnel)
export const handleSessionExpiry = async () => {
  try {
    // First, try to get the current session (reads from AsyncStorage, no network needed)
    // Use a short timeout to avoid hanging on network issues
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Session check timeout')), 3000); // 3 second timeout
    });

    let session, error;
    try {
      const result = await Promise.race([sessionPromise, timeoutPromise]);
      session = result.data?.session;
      error = result.error;
    } catch (timeoutError) {
      // On timeout, try one more time without timeout (might be slow network)
      console.log('⚠️ Session check timed out, retrying without timeout...');
      try {
        const retryResult = await supabase.auth.getSession();
        session = retryResult.data?.session;
        error = retryResult.error;
      } catch (retryError) {
        console.error('❌ Session retry failed:', retryError);
        return null;
      }
    }

    // If we have a session (even if expired), return it immediately
    // The app can validate/refresh it later when network is available
    if (session && session.user) {
      // Check if session is expired
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at < now) {
        // Session expired, but try to refresh it (non-blocking)
        console.log('🔄 Session expired, attempting to refresh...');
        // Don't wait for refresh - return session immediately and refresh in background
        supabase.auth.refreshSession().then(({ data: { session: refreshedSession }, error: refreshError }) => {
          if (refreshedSession && !refreshError) {
            console.log('✅ Session refreshed in background');
          } else {
            console.log('⚠️ Background refresh failed:', refreshError?.message);
          }
        }).catch(err => {
          console.log('⚠️ Background refresh error:', err);
        });
        // Return expired session anyway - app can handle it
        return session;
      } else {
        // Session is valid
        return session;
      }
    }

    // If no session, check for stored credentials (only if no network timeout)
    if (!error || error.message !== 'Session check timeout') {
      const storedEmail = await AsyncStorage.getItem('remembered_email');
      const storedPassword = await AsyncStorage.getItem('remembered_password');

      if (storedEmail && storedPassword) {
        console.log('🔄 Attempting auto-login with stored credentials...');
        // Auto-login with stored credentials (with timeout)
        try {
          const loginPromise = supabase.auth.signInWithPassword({
            email: storedEmail,
            password: storedPassword,
          });
          const loginTimeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Login timeout')), 5000);
          });

          const loginResult = await Promise.race([loginPromise, loginTimeout]);
          if (loginResult.data?.session) {
            console.log('✅ Auto-login successful');
            return loginResult.data.session;
          }
        } catch (loginError) {
          console.log('⚠️ Auto-login failed:', loginError.message);
          // Don't clear credentials on timeout - might be network issue
          if (loginError.message !== 'Login timeout') {
            await AsyncStorage.removeItem('remembered_email');
            await AsyncStorage.removeItem('remembered_password');
          }
        }
      }
    }

    // If we still have a session object (even if expired), return it
    if (session) {
      console.log('⚠️ Returning session (may be expired):', session.user?.email);
      return session;
    }

    console.log('❌ No valid session found');
    return null;
  } catch (error) {
    console.error('❌ Session handling error:', error);
    // Last resort: try to get session one more time
    try {
      const { data: { session: lastResortSession } } = await supabase.auth.getSession();
      if (lastResortSession) {
        console.log('✅ Got session on last resort attempt');
        return lastResortSession;
      }
    } catch (lastError) {
      console.error('❌ Last resort also failed:', lastError);
    }
    return null;
  }
};

// Store credentials for "Remember Me" functionality
export const rememberUser = async (email, password) => {
  try {
    await AsyncStorage.setItem('remembered_email', email);
    await AsyncStorage.setItem('remembered_password', password);
  } catch (error) {
    console.error('Error storing credentials:', error);
  }
};

// Clear stored credentials
export const forgetUser = async () => {
  try {
    await AsyncStorage.removeItem('remembered_email');
    await AsyncStorage.removeItem('remembered_password');
  } catch (error) {
    console.error('Error clearing credentials:', error);
  }
};

export default supabase;
