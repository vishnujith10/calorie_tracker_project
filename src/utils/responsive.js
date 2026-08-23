import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (iPhone 14 Plus - 6.7" screen)
const BASE_WIDTH = 428;
const BASE_HEIGHT = 926;

// Responsive scaling functions
export const scaleWidth = (size) => {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

export const scaleHeight = (size) => {
  return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
};

export const scaleFont = (size) => {
  const scale = Math.min(SCREEN_WIDTH / BASE_WIDTH, SCREEN_HEIGHT / BASE_HEIGHT);
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Screen size categories
export const isSmallScreen = () => SCREEN_WIDTH < 375; // iPhone SE, older phones
export const isMediumScreen = () => SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 390; // iPhone 12 Mini
export const isLargeScreen = () => SCREEN_WIDTH >= 390; // iPhone 12, 13, 14

// Responsive padding/margin
export const getResponsivePadding = (basePadding) => {
  if (isSmallScreen()) return basePadding * 0.8;
  if (isMediumScreen()) return basePadding * 0.9;
  return basePadding;
};

// Responsive font sizes
export const getResponsiveFontSize = (baseSize) => {
  if (isSmallScreen()) return scaleFont(baseSize * 0.9);
  if (isMediumScreen()) return scaleFont(baseSize * 0.95);
  return scaleFont(baseSize);
};

// Responsive icon sizes
export const getResponsiveIconSize = (baseSize) => {
  if (isSmallScreen()) return baseSize * 0.8;
  if (isMediumScreen()) return baseSize * 0.9;
  return baseSize;
};

// Safe area helpers
export const getSafeAreaInsets = () => {
  // These values should be used with SafeAreaView
  return {
    top: isSmallScreen() ? 20 : 44,
    bottom: isSmallScreen() ? 20 : 34,
    left: 0,
    right: 0,
  };
};

export default {
  scaleWidth,
  scaleHeight,
  scaleFont,
  isSmallScreen,
  isMediumScreen,
  isLargeScreen,
  getResponsivePadding,
  getResponsiveFontSize,
  getResponsiveIconSize,
  getSafeAreaInsets,
};
