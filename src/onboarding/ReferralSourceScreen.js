import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import React, { useContext, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { OnboardingContext } from "../context/OnboardingContext";
import { useTheme } from "../context/ThemeContext";

const APP_PRIMARY = "#1F4E4A";
const APP_MINT = "#A8D5CE";
const APP_BG = "#F4FBFA";
const APP_SURFACE = "#FFFFFF";
const APP_SURFACE_SOFT = "#EEF7F5";
const APP_BORDER = "#D7E9E5";
const APP_TEXT = "#173936";
const APP_TEXT_SOFT = "#6F8C87";

const options = [
  { label: "Instagram", icon: "logo-instagram" },
  { label: "TikTok", icon: "logo-tiktok" },
  { label: "YouTube", icon: "logo-youtube" },
  { label: "Google Search", icon: "search" },
  { label: "App Store", icon: "apps" },
  { label: "Friend / Referral", icon: "people" },
  { label: "Other", icon: "pencil" },
];

const saveOnboardingData = async (key, value) => {
  try {
    const existing = await AsyncStorage.getItem("onboardingData");
    const data = existing ? JSON.parse(existing) : {};
    data[key] = value;
    await AsyncStorage.setItem("onboardingData", JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save onboarding data", e);
  }
};

const ReferralSourceScreen = ({ navigation }) => {
  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [selected, setSelected] = useState(null);
  const [otherText, setOtherText] = useState("");
  const inputRef = useRef(null);
  const scrollViewRef = useRef(null);

  const isOtherSelected = selected === 6;
  const isContinueEnabled =
    selected !== null &&
    (!isOtherSelected || (isOtherSelected && otherText.trim().length > 0));

  const handleOptionSelect = (idx) => {
    setSelected(idx);
    if (idx !== 6) setOtherText("");
  };

  const handleContinue = (selectedSource) => {
    setOnboardingData({
      ...onboardingData,
      social_refference: selectedSource,
    });
    navigation.navigate("ActivityLevel");
  };

  const handleOtherInputFocus = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background || APP_BG,
        },
        pageTintTop: {
          position: "absolute",
          top: -20,
          right: -45,
          width: 170,
          height: 170,
          borderRadius: 85,
          backgroundColor: "rgba(168, 213, 206, 0.24)",
        },
        pageTintBottom: {
          position: "absolute",
          left: -50,
          bottom: 120,
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: "rgba(31, 78, 74, 0.06)",
        },
        subtitle: {
          fontSize: 11,
          color: APP_TEXT_SOFT,
          fontFamily: "Manrope-Regular",
          letterSpacing: 1.8,
          fontWeight: "700",
          marginBottom: 8,
        },
        title: {
          fontSize: 30,
          fontWeight: "800",
          color: APP_TEXT,
          fontFamily: "Lexend-Bold",
          letterSpacing: -0.6,
          marginBottom: 10,
          lineHeight: 36,
        },
        description: {
          fontSize: 15,
          color: APP_TEXT_SOFT,
          fontFamily: "Manrope-Regular",
          lineHeight: 23,
        },
        heroCard: {
          backgroundColor: APP_PRIMARY,
          borderRadius: 28,
          padding: 22,
          marginBottom: 22,
          shadowColor: "#163533",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: isDark ? 0.18 : 0.14,
          shadowRadius: 20,
          elevation: 6,
        },
        heroEyebrow: {
          fontSize: 11,
          color: "rgba(255,255,255,0.72)",
          fontFamily: "Manrope-Regular",
          letterSpacing: 1.8,
          fontWeight: "700",
          marginBottom: 8,
        },
        heroTitle: {
          fontSize: 27,
          lineHeight: 33,
          color: "#FFFFFF",
          fontFamily: "Lexend-Bold",
          letterSpacing: -0.5,
          marginBottom: 10,
        },
        heroText: {
          fontSize: 14,
          lineHeight: 22,
          color: "rgba(255,255,255,0.78)",
          fontFamily: "Manrope-Regular",
        },
        optionCard: {
          backgroundColor: APP_SURFACE,
          borderRadius: 20,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: APP_BORDER,
          shadowColor: "#183A37",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.16 : 0.05,
          shadowRadius: 16,
          elevation: 2,
        },
        optionText: {
          fontSize: 16,
          fontWeight: "700",
          color: APP_TEXT,
          fontFamily: "Manrope-Regular",
          marginLeft: 14,
          flex: 1,
        },
        otherInputCard: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: APP_SURFACE,
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 16,
          gap: 12,
          marginBottom: 20,
          borderWidth: 1.5,
          borderColor: APP_PRIMARY,
          shadowColor: "#183A37",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.16 : 0.06,
          shadowRadius: 16,
          elevation: 3,
        },
        otherInput: {
          flex: 1,
          fontSize: 16,
          fontFamily: "Manrope-Regular",
          color: APP_TEXT,
        },
        infoCard: {
          backgroundColor: APP_SURFACE_SOFT,
          borderRadius: 20,
          padding: 16,
          marginTop: 6,
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: "#E0EFEB",
        },
        infoText: {
          fontSize: 14,
          color: APP_TEXT_SOFT,
          fontFamily: "Manrope-Regular",
          marginLeft: 12,
          flex: 1,
          lineHeight: 21,
        },
      }),
    [colors.background, isDark],
  );

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={dynamicStyles.pageTintTop} pointerEvents="none" />
      <View style={dynamicStyles.pageTintBottom} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <View style={styles.backButtonCircle}>
              <Ionicons name="chevron-back" size={22} color={APP_TEXT} />
            </View>
          </TouchableOpacity>
          <View style={{ width: 46 }} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 170 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.contentWrapper}>
            <View style={dynamicStyles.heroCard}>
              <Text style={dynamicStyles.heroEyebrow}>DISCOVERY</Text>
              <Text style={dynamicStyles.heroTitle}>
                How did you hear about Us?
              </Text>
            </View>

            <View style={styles.header}>
              <Text style={dynamicStyles.subtitle}>CHOOSE ONE SOURCE</Text>

              <Text style={dynamicStyles.description}>
                This stays internal and is only used to improve growth
                decisions.
              </Text>
            </View>

            <View style={styles.optionsGrid}>
              {options.map((option, idx) => {
                const isSelected = selected === idx;

                return (
                  <TouchableOpacity
                    key={option.label}
                    style={[
                      dynamicStyles.optionCard,
                      isSelected && styles.optionCardSelected,
                    ]}
                    onPress={() => handleOptionSelect(idx)}
                    activeOpacity={0.78}
                  >
                    <View style={styles.optionContent}>
                      <View
                        style={[
                          styles.iconWrapper,
                          isSelected && styles.iconWrapperSelected,
                        ]}
                      >
                        <Ionicons
                          name={option.icon}
                          size={22}
                          color={isSelected ? "#FFFFFF" : APP_PRIMARY}
                        />
                      </View>

                      <Text style={dynamicStyles.optionText}>
                        {option.label}
                      </Text>

                      {isSelected ? (
                        <View style={styles.checkCircle}>
                          <MaterialIcons
                            name="check"
                            size={15}
                            color="#FFFFFF"
                          />
                        </View>
                      ) : (
                        <View style={styles.emptyCircle} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {isOtherSelected && (
              <View style={dynamicStyles.otherInputCard}>
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={20}
                  color={APP_TEXT_SOFT}
                />
                <TextInput
                  ref={inputRef}
                  style={dynamicStyles.otherInput}
                  placeholder="Tell us where you found Calora..."
                  value={otherText}
                  onChangeText={setOtherText}
                  onFocus={handleOtherInputFocus}
                  autoFocus
                  placeholderTextColor={APP_TEXT_SOFT}
                />
              </View>
            )}

            <View style={dynamicStyles.infoCard}>
              <View style={styles.infoIconWrap}>
                <MaterialCommunityIcons
                  name="shield-check"
                  size={16}
                  color={APP_PRIMARY}
                />
              </View>
              <Text style={dynamicStyles.infoText}>
                We never share this response and we do not use it for ads.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.buttonContainer,
            {
              paddingBottom: Math.max(16, insets.bottom + 10),
              backgroundColor: APP_BG,
              borderTopColor: "rgba(31,78,74,0.08)",
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.ctaButton,
              !isContinueEnabled && styles.ctaButtonDisabled,
            ]}
            disabled={!isContinueEnabled}
            onPress={() =>
              handleContinue(
                selected === 6 ? otherText.trim() : options[selected].label,
              )
            }
            activeOpacity={0.88}
          >
            {isContinueEnabled ? (
              <View style={styles.buttonActive}>
                <Text style={styles.buttonText}>Continue</Text>
                <MaterialIcons name="arrow-forward" size={22} color="#FFFFFF" />
              </View>
            ) : (
              <View style={styles.buttonDisabled}>
                <Text style={styles.buttonTextDisabled}>Select an option</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 18,
  },
  backButton: {
    zIndex: 10,
  },
  backButtonCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7E9E5",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 24,
  },
  optionsGrid: {
    marginBottom: 18,
  },
  optionCardSelected: {
    borderColor: "#1F4E4A",
    backgroundColor: "#F8FCFB",
    shadowColor: "#1F4E4A",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrapper: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF5F2",
  },
  iconWrapperSelected: {
    backgroundColor: "#1F4E4A",
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#1F4E4A",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#CFE2DD",
  },
  infoIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  ctaButton: {
    borderRadius: 18,
    overflow: "hidden",
  },
  buttonActive: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 10,
    backgroundColor: "#1F4E4A",
    borderRadius: 18,
    shadowColor: "#163533",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 4,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Lexend-Bold",
    letterSpacing: 0.2,
  },
  ctaButtonDisabled: {
    opacity: 1,
  },
  buttonDisabled: {
    backgroundColor: "#DCE8E5",
    paddingVertical: 18,
    alignItems: "center",
    borderRadius: 18,
  },
  buttonTextDisabled: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6F8C87",
    fontFamily: "Manrope-Regular",
  },
});

export default ReferralSourceScreen;
