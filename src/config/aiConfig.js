/**
 * Central AI Configuration
 * 
 * Manage all Gemini AI model references in one place.
 * When Google updates or deprecates a model version, simply update this file.
 */

export const AI_CONFIG = {
  // Primary model for fast, high-quality responses
  PRIMARY_MODEL: 'gemini-3.6-flash',

  // Secondary model used if primary model is busy (503) or rate limited
  FALLBACK_MODEL: 'gemini-3.5-flash-lite',

  // Array of models ordered by preference for automatic fallback handling
  MODELS: ['gemini-3.6-flash', 'gemini-3.5-flash-lite'],

  // Vision-capable models for image recognition
  VISION_MODELS: ['gemini-3.6-flash', 'gemini-3.5-flash-lite'],
};
