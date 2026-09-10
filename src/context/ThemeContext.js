import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import supabase from '../lib/supabase';

const THEME_STORAGE_KEY = 'calora_app_theme';

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
      const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme && (storedTheme === 'Light' || storedTheme === 'Dark')) {
        setTheme(storedTheme);
      } else {
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
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
      setTheme(newTheme);
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

