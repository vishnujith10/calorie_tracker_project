/**
 * DAILY CHECK-IN MODAL COMPONENT
 * Provides a user-friendly interface for daily check-in questions
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";

// Shared palette — mirrors the teal design system used across the app
// (Home dashboard, Weight Tracker, Add Weight, Journal/Timeline, etc.)
const createPalette = (isDark) => ({
  primary: "#1F4E4A",
  primaryMuted: "#3D6A66",
  primaryLight: "#A8D5CE",
  background: isDark ? "#0F1E1C" : "#F4FBFA",
  card: isDark ? "#17302D" : "#FFFFFF",
  cardSecondary: isDark ? "#1C3935" : "#EEF7F5",
  cardTertiary: isDark ? "#21413D" : "#E8F3F1",
  textPrimary: isDark ? "#F4FBFA" : "#163633",
  textSecondary: isDark ? "#BED9D3" : "#5B7873",
  textMuted: isDark ? "#8FAAA5" : "#7D9994",
  border: isDark ? "#2C4A46" : "#D5E8E3",
  borderStrong: isDark ? "#466963" : "#BFD8D3",
  shadow: "#102624",
  selectedCard: isDark ? "#1D403B" : "#E6F5F1",
  disabledBg: isDark ? "#233F3B" : "#DCEAE7",
});

export const DailyCheckInModal = ({
  visible,
  onClose,
  onComplete,
  userProfile,
}) => {
  const insets = useSafeAreaInsets(); // Get safe area insets for bottom navigation
  const { isDark } = useTheme();
  const palette = useMemo(() => createPalette(isDark), [isDark]);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState({});

  const questions = [
    {
      id: "sleep",
      question: "How many hours did you sleep last night?",
      type: "number",
      range: [0, 12],
      default: 7,
      icon: "😴",
    },
    {
      id: "energy",
      question: "What's your energy level today?",
      type: "select",
      options: ["Very Low", "Low", "Medium", "High", "Very High"],
      icon: "⚡",
    },
    {
      id: "stress",
      question: "How stressed do you feel?",
      type: "select",
      options: ["Very Low", "Low", "Medium", "High", "Very High"],
      icon: "🧘‍♀️",
    },
    {
      id: "mood",
      question: "How's your mood today?",
      type: "scale",
      range: [1, 10],
      labels: { 1: "😔 Low", 5: "😐 Neutral", 10: "😊 Great" },
      icon: "😊",
    },
    {
      id: "situation",
      question: "Anything special happening today?",
      type: "multi-select",
      options: [
        "Normal day",
        "Feeling sick",
        "Traveling",
        "High stress/busy",
        "Period/PMS",
        "Special event/celebration",
        "Extra active day",
        "Working late",
      ],
      icon: "📅",
    },
  ];

  const currentQuestion = questions[currentQuestionIndex];

  const handleResponse = (value) => {
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    // Pass the raw responses to the completion callback
    // Let the parent component handle the processing
    onComplete(responses);

    // Reset for next time
    setCurrentQuestionIndex(0);
    setResponses({});
    onClose();
  };

  const renderQuestion = () => {
    const currentResponse = responses[currentQuestion.id];

    switch (currentQuestion.type) {
      case "number":
        return (
          <View style={styles.numberInput}>
            <Text style={styles.numberValue}>
              {currentResponse || currentQuestion.default}
            </Text>
            <Text style={styles.numberUnit}>hours</Text>
            <View style={styles.numberControls}>
              <TouchableOpacity
                style={styles.numberButton}
                onPress={() =>
                  handleResponse(
                    Math.max(
                      0,
                      (currentResponse || currentQuestion.default) - 0.5,
                    ),
                  )
                }
              >
                <Ionicons name="remove" size={20} color={palette.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.numberButton}
                onPress={() =>
                  handleResponse(
                    Math.min(
                      12,
                      (currentResponse || currentQuestion.default) + 0.5,
                    ),
                  )
                }
              >
                <Ionicons name="add" size={20} color={palette.primary} />
              </TouchableOpacity>
            </View>
          </View>
        );

      case "select":
        return (
          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  currentResponse === option && styles.selectedOption,
                ]}
                onPress={() => handleResponse(option)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.optionText,
                    currentResponse === option && styles.selectedOptionText,
                  ]}
                >
                  {option}
                </Text>
                <Ionicons
                  name={
                    currentResponse === option
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={20}
                  color={
                    currentResponse === option
                      ? palette.primary
                      : palette.borderStrong
                  }
                />
              </TouchableOpacity>
            ))}
          </View>
        );

      case "scale":
        return (
          <View style={styles.scaleContainer}>
            <View style={styles.scaleLabelRow}>
              <Text style={styles.scaleLabelText}>
                {currentQuestion.labels[1]}
              </Text>
              <Text style={styles.scaleLabelArrow}>→</Text>
              <Text style={styles.scaleLabelText}>
                {currentQuestion.labels[10]}
              </Text>
            </View>
            <View style={styles.scaleButtons}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.scaleButton,
                    currentResponse === value && styles.selectedScaleButton,
                  ]}
                  onPress={() => handleResponse(value)}
                >
                  <Text
                    style={[
                      styles.scaleButtonText,
                      currentResponse === value &&
                        styles.selectedScaleButtonText,
                    ]}
                  >
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case "multi-select":
        const selectedOptions = currentResponse || [];
        return (
          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  selectedOptions.includes(option) && styles.selectedOption,
                ]}
                onPress={() => {
                  const newSelection = selectedOptions.includes(option)
                    ? selectedOptions.filter((opt) => opt !== option)
                    : [...selectedOptions, option];
                  handleResponse(newSelection);
                }}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedOptions.includes(option) &&
                      styles.selectedOptionText,
                  ]}
                >
                  {option}
                </Text>
                <Ionicons
                  name={
                    selectedOptions.includes(option)
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={20}
                  color={
                    selectedOptions.includes(option)
                      ? palette.primary
                      : palette.borderStrong
                  }
                />
              </TouchableOpacity>
            ))}
          </View>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    const currentResponse = responses[currentQuestion.id];
    if (currentQuestion.type === "multi-select") {
      return Array.isArray(currentResponse) && currentResponse.length > 0;
    }
    return currentResponse !== undefined && currentResponse !== null;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Text style={styles.title}>Daily Check-in</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {currentQuestionIndex + 1} of {questions.length}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.questionCard}>
            <View style={styles.questionIconShell}>
              <Text style={styles.questionIcon}>{currentQuestion.icon}</Text>
            </View>
            <Text style={styles.questionText}>{currentQuestion.question}</Text>
            {renderQuestion()}
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom >= 20 ? insets.bottom + 20 : 20 },
          ]}
        >
          {currentQuestionIndex > 0 && (
            <TouchableOpacity
              style={styles.previousButton}
              onPress={handlePrevious}
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-back" size={18} color={palette.primary} />
              <Text style={styles.previousButtonText}>Previous</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.nextButton,
              !canProceed() && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={!canProceed()}
            activeOpacity={0.9}
          >
            <Text
              style={[
                styles.nextButtonText,
                !canProceed() && styles.nextButtonTextDisabled,
              ]}
            >
              {currentQuestionIndex === questions.length - 1
                ? "Complete"
                : "Next"}
            </Text>
            {currentQuestionIndex < questions.length - 1 && (
              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },

    // Header
    header: {
      paddingHorizontal: 22,
      paddingTop: 16,
      paddingBottom: 18,
    },
    headerTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 14,
      backgroundColor: palette.cardSecondary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    progressContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    progressBar: {
      flex: 1,
      height: 8,
      backgroundColor: palette.cardSecondary,
      borderRadius: 999,
      marginRight: 10,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: palette.primary,
      borderRadius: 999,
    },
    progressText: {
      fontSize: 12,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
    },

    // Question
    content: {
      flex: 1,
      paddingHorizontal: 22,
    },
    questionCard: {
      backgroundColor: palette.card,
      borderRadius: 28,
      paddingVertical: 30,
      paddingHorizontal: 22,
      marginTop: 12,
      marginBottom: 24,
      alignItems: "center",
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    questionIconShell: {
      width: 64,
      height: 64,
      borderRadius: 22,
      backgroundColor: palette.cardSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
      borderWidth: 1,
      borderColor: palette.border,
    },
    questionIcon: {
      fontSize: 32,
    },
    questionText: {
      fontSize: 19,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
      textAlign: "center",
      marginBottom: 26,
      lineHeight: 26,
    },

    // Number input
    numberInput: {
      alignItems: "center",
      width: "100%",
    },
    numberValue: {
      fontSize: 48,
      fontFamily: "Lexend-Bold",
      color: palette.primary,
    },
    numberUnit: {
      fontSize: 13,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 18,
    },
    numberControls: {
      flexDirection: "row",
      gap: 16,
    },
    numberButton: {
      width: 48,
      height: 48,
      borderRadius: 18,
      backgroundColor: palette.cardSecondary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },

    // Options (select / multi-select)
    optionsContainer: {
      width: "100%",
      gap: 10,
    },
    optionButton: {
      paddingVertical: 15,
      paddingHorizontal: 18,
      borderRadius: 18,
      backgroundColor: palette.cardSecondary,
      borderWidth: 1,
      borderColor: palette.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    selectedOption: {
      backgroundColor: palette.selectedCard,
      borderColor: palette.primary,
    },
    optionText: {
      fontSize: 15,
      fontFamily: "Manrope-SemiBold",
      color: palette.textPrimary,
    },
    selectedOptionText: {
      color: palette.primary,
      fontFamily: "Lexend-SemiBold",
    },

    // Scale
    scaleContainer: {
      width: "100%",
      alignItems: "center",
    },
    scaleLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 18,
    },
    scaleLabelText: {
      fontSize: 13,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
    },
    scaleLabelArrow: {
      fontSize: 13,
      color: palette.textMuted,
      marginHorizontal: 8,
    },
    scaleButtons: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      justifyContent: "center",
    },
    scaleButton: {
      width: 40,
      height: 40,
      borderRadius: 16,
      backgroundColor: palette.cardSecondary,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      justifyContent: "center",
    },
    selectedScaleButton: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
    },
    scaleButtonText: {
      fontSize: 15,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
    },
    selectedScaleButtonText: {
      color: "#FFFFFF",
    },

    // Footer
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 22,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },
    previousButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 13,
      paddingHorizontal: 18,
      borderRadius: 18,
      backgroundColor: palette.cardSecondary,
      borderWidth: 1,
      borderColor: palette.border,
    },
    previousButtonText: {
      fontSize: 14,
      fontFamily: "Lexend-SemiBold",
      color: palette.primary,
      marginLeft: 4,
    },
    nextButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.primary,
      paddingVertical: 15,
      paddingHorizontal: 26,
      borderRadius: 20,
      flex: 1,
      justifyContent: "center",
      marginLeft: 14,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.14,
      shadowRadius: 12,
      elevation: 4,
    },
    nextButtonDisabled: {
      backgroundColor: palette.disabledBg,
      shadowOpacity: 0,
      elevation: 0,
    },
    nextButtonText: {
      fontSize: 15,
      fontFamily: "Lexend-SemiBold",
      color: "#FFFFFF",
      marginRight: 4,
    },
    nextButtonTextDisabled: {
      color: palette.textMuted,
    },
  });
