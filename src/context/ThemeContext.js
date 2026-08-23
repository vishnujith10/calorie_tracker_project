import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import supabase from '../lib/supabase';

const THEME_STORAGE_KEY = 'kalry_app_theme';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('Light');
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from database on mount
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      // First, try to load from AsyncStorage (works even when logged out)
      const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme && (storedTheme === 'Light' || storedTheme === 'Dark')) {
        setTheme(storedTheme);
      }

      // Then, try to load from database if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('user_app_settings')
          .select('theme')
          .eq('user_id', user.id)
          .single();

        if (!error && data?.theme) {
          // Update theme from database and sync to AsyncStorage
          setTheme(data.theme);
          await AsyncStorage.setItem(THEME_STORAGE_KEY, data.theme);
        } else if (error && error.code !== 'PGRST116' && error.code !== 'PGRST205') {
          console.error('Error loading theme from database:', error);
        }
      }

      // If no theme found anywhere, default to Light
      if (!storedTheme && !user) {
        setTheme('Light');
      }
    } catch (error) {
      console.error('Error loading theme:', error);
      setTheme('Light');
    } finally {
      setIsLoading(false);
    }
  };

  const updateTheme = async (newTheme) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
      setTheme(newTheme);

      if (!user) {
        return;
      }

      const { error } = await supabase
        .from('user_app_settings')
        .upsert(
          {
            user_id: user.id,
            theme: newTheme,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        );

      if (error && error.code !== 'PGRST205') {
        console.error('Error saving theme:', error);
        Alert.alert('Error', 'Failed to save theme preference.');
        return;
      }

      // Already set above
    } catch (error) {
      console.error('Error updating theme:', error);
    }
  };

  const isDark = theme === 'Dark';

  // Theme colors
  const colors = {
    light: {
      background: '#F8F9FE',
      cardBackground: '#FFFFFF',
      textPrimary: '#1A1D2E',
      textSecondary: '#6B7280',
      textMuted: '#999999',
      border: '#E5E7EB',
      primary: '#A182F9',
      accent: '#FAD89B',
      shadow: '#000000',
    },
    dark: {
      background: '#0F0F1E',
      cardBackground: '#1A1A2E',
      textPrimary: '#FFFFFF',
      textSecondary: '#B0B0B0',
      textMuted: '#808080',
      border: '#2A2A3E',
      primary: '#A182F9',
      accent: '#FAD89B',
      shadow: '#000000',
    },
  };

  const themeColors = isDark ? colors.dark : colors.light;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        updateTheme,
        colors: themeColors,
        isLoading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

