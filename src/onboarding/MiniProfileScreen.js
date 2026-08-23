import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Animated,
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
const APP_SUCCESS = "#2E6B5F";
const APP_WARNING = "#7A5C1B";
const APP_ALERT = "#8D5A46";

const genders = ["Male", "Female"];

const MiniProfileScreen = () => {
  const navigation = useNavigation();
  const { setOnboardingData } = useContext(OnboardingContext);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedGender, setSelectedGender] = useState("Male");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [isMetric, setIsMetric] = useState(true);
  const [isGoogleUser, setIsGoogleUser] = useState(false);

  const scrollViewRef = React.useRef(null);
  const heightInputRef = React.useRef(null);
  const weightInputRef = React.useRef(null);
  const genderRowRef = React.useRef(null);
  const unitToggleRef = React.useRef(null);

  const [genderRowWidth, setGenderRowWidth] = useState(0);
  const [unitToggleWidth, setUnitToggleWidth] = useState(0);

  const genderSlideAnim = React.useRef(
    new Animated.Value(selectedGender === "Male" ? 0 : 1),
  ).current;
  const unitSlideAnim = React.useRef(
    new Animated.Value(isMetric ? 0 : 1),
  ).current;

  const measureGenderRow = (event) => {
    const { width } = event.nativeEvent.layout;
    setGenderRowWidth(width);
  };

  const measureUnitToggle = (event) => {
    const { width } = event.nativeEvent.layout;
    setUnitToggleWidth(width);
  };

  useEffect(() => {
    Animated.timing(genderSlideAnim, {
      toValue: selectedGender === "Male" ? 0 : 1,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [selectedGender]);

  useEffect(() => {
    Animated.timing(unitSlideAnim, {
      toValue: isMetric ? 0 : 1,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [isMetric]);

  useFocusEffect(
    React.useCallback(() => {
      if (global.googleUserData) {
        navigation.getParent()?.setOptions({
          gestureEnabled: false,
        });
      }

      return () => {
        navigation.getParent()?.setOptions({
          gestureEnabled: true,
        });
      };
    }, [navigation]),
  );

  useEffect(() => {
    if (global.googleUserData) {
      const fullName = global.googleUserData.user_metadata?.full_name || "User";
      const firstName = fullName.split(" ")[0];
      setName(firstName);
      setIsGoogleUser(true);
    }
  }, []);

  const handleHeightCmChange = (val) => {
    setHeightCm(val);
    if (val && !isNaN(Number(val))) {
      setHeightFt((Number(val) / 30.48).toFixed(2));
    } else {
      setHeightFt("");
    }
  };

  const handleHeightFtChange = (val) => {
    setHeightFt(val);
    if (val && !isNaN(Number(val))) {
      setHeightCm((Number(val) * 30.48).toFixed(0));
    } else {
      setHeightCm("");
    }
  };

  const handleWeightKgChange = (val) => {
    setWeightKg(val);
    if (val && !isNaN(Number(val))) {
      setWeightLbs((Number(val) * 2.20462).toFixed(1));
    } else {
      setWeightLbs("");
    }
  };

  const handleWeightLbsChange = (val) => {
    setWeightLbs(val);
    if (val && !isNaN(Number(val))) {
      setWeightKg((Number(val) / 2.20462).toFixed(1));
    } else {
      setWeightKg("");
    }
  };

  const minHeightCm = 100;
  const minHeightFt = 3.3;
  const minWeightKg = 30;
  const minWeightLbs = 66;

  const allFieldsFilled =
    name.trim().length > 0 &&
    age.trim().length > 0 &&
    selectedGender.trim().length > 0 &&
    heightCm.trim().length > 0 &&
    heightFt.trim().length > 0 &&
    weightKg.trim().length > 0 &&
    weightLbs.trim().length > 0 &&
    !isNaN(Number(age)) &&
    !isNaN(Number(heightCm)) &&
    !isNaN(Number(heightFt)) &&
    !isNaN(Number(weightKg)) &&
    !isNaN(Number(weightLbs));

  const validHeight =
    Number(heightCm) >= minHeightCm && Number(heightFt) >= minHeightFt;
  const validWeight =
    Number(weightKg) >= minWeightKg && Number(weightLbs) >= minWeightLbs;

  const canShowBMI = allFieldsFilled && validHeight && validWeight;
  const canContinue = canShowBMI;

  let bmi = "";
  let bmiStatus = "";
  let bmiColor = "";
  let bmiTone = APP_SURFACE_SOFT;

  if (canShowBMI) {
    const h = Number(heightCm) / 100;
    const w = Number(weightKg);

    if (h > 0) {
      bmi = (w / (h * h)).toFixed(1);
      const bmiNum = Number(bmi);

      if (bmiNum < 18.5) {
        bmiStatus = "Underweight";
        bmiColor = APP_ALERT;
        bmiTone = "#F6EEE9";
      } else if (bmiNum >= 18.5 && bmiNum < 25) {
        bmiStatus = "Healthy";
        bmiColor = APP_SUCCESS;
        bmiTone = "#E7F3F0";
      } else if (bmiNum >= 25 && bmiNum < 30) {
        bmiStatus = "Overweight";
        bmiColor = APP_WARNING;
        bmiTone = "#F5F0E1";
      } else {
        bmiStatus = "Obese";
        bmiColor = APP_ALERT;
        bmiTone = "#F6EEE9";
      }
    }
  }

  const handleContinue = async () => {
    setOnboardingData({
      name,
      age,
      gender: selectedGender,
      heightCm,
      heightFt,
      weightKg,
      weightLbs,
      isMetric,
      bmi,
      googleId: isGoogleUser ? global.googleUserData?.id : null,
      googleEmail: isGoogleUser ? global.googleUserData?.email : null,
    });

    try {
      await AsyncStorage.setItem(
        "kalry_onboarding_weight",
        isMetric ? weightKg : weightLbs,
      );
      await AsyncStorage.setItem(
        "kalry_onboarding_height",
        isMetric ? heightCm : heightFt,
      );
      await AsyncStorage.setItem(
        "kalry_onboarding_unit",
        isMetric ? "kg" : "lbs",
      );
    } catch (e) {
      console.warn("Failed to save onboarding weight/height to storage", e);
    }

    if (isGoogleUser) {
      navigation.navigate("ActivityLevel");
    } else {
      navigation.navigate("ReferralSource");
    }
  };

  const handleHeightFocus = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

  const handleWeightFocus = () => {
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
          paddingTop: Platform.OS === "android" ? 3 : 0,
        },
        heading: {
          fontSize: 22,
          fontFamily: "Lexend-Bold",
          color: APP_TEXT,
          textAlign: "center",
          letterSpacing: -0.3,
        },
        pageTintTop: {
          position: "absolute",
          top: -30,
          right: -40,
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: "rgba(168, 213, 206, 0.22)",
        },
        pageTintBottom: {
          position: "absolute",
          left: -50,
          bottom: 130,
          width: 170,
          height: 170,
          borderRadius: 85,
          backgroundColor: "rgba(31, 78, 74, 0.06)",
        },
        sectionTitle: {
          fontSize: 12,
          color: APP_TEXT_SOFT,
          fontFamily: "Manrope-Regular",
          letterSpacing: 1.7,
          fontWeight: "700",
          marginBottom: 8,
        },
        introCard: {
          backgroundColor: APP_PRIMARY,
          borderRadius: 28,
          padding: 22,
          marginHorizontal: 24,
          marginBottom: 22,
          shadowColor: "#11322F",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.16,
          shadowRadius: 20,
          elevation: 6,
        },
        introEyebrow: {
          fontSize: 11,
          color: "rgba(255,255,255,0.72)",
          fontFamily: "Manrope-Regular",
          letterSpacing: 1.8,
          fontWeight: "700",
          marginBottom: 8,
        },
        introTitle: {
          fontSize: 28,
          lineHeight: 34,
          color: "#FFFFFF",
          fontFamily: "Lexend-Bold",
          letterSpacing: -0.6,
          marginBottom: 10,
        },
        introText: {
          fontSize: 14,
          lineHeight: 22,
          color: "rgba(255,255,255,0.78)",
          fontFamily: "Manrope-Regular",
          maxWidth: "92%",
        },
        label: {
          fontSize: 13,
          fontWeight: "700",
          color: APP_TEXT_SOFT,
          marginBottom: 10,
          fontFamily: "Manrope-Regular",
          letterSpacing: 0.2,
        },
        inputShell: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: APP_SURFACE,
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 6,
          minHeight: 62,
          borderWidth: 1,
          borderColor: APP_BORDER,
          shadowColor: "#183A37",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.16 : 0.05,
          shadowRadius: 18,
          elevation: 2,
        },
        input: {
          flex: 1,
          height: 48,
          fontSize: 16,
          color: APP_TEXT,
          fontFamily: "Manrope-Regular",
          marginLeft: 12,
        },
        measurementCard: {
          backgroundColor: APP_SURFACE,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: APP_BORDER,
          shadowColor: "#183A37",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.12 : 0.04,
          shadowRadius: 10,
          elevation: 2,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        measurementLabel: {
          fontSize: 13,
          fontWeight: "700",
          color: APP_TEXT_SOFT,
          fontFamily: "Manrope-Regular",
          letterSpacing: 0.5,
          minWidth: 60,
        },
        measurementInput: {
          fontSize: 22,
          fontWeight: "700",
          color: APP_TEXT,
          fontFamily: "Lexend-Bold",
          flex: 1,
          padding: 0,
        },
        measurementUnit: {
          fontSize: 15,
          color: APP_TEXT_SOFT,
          fontFamily: "Manrope-Regular",
          marginLeft: 8,
          fontWeight: "700",
        },
        googleWelcomeText: {
          fontSize: 14,
          color: APP_TEXT,
          fontFamily: "Manrope-Regular",
          marginLeft: 10,
          flex: 1,
          lineHeight: 21,
        },
        sectionCard: {
          backgroundColor: APP_SURFACE_SOFT,
          borderRadius: 24,
          padding: 16,
          marginBottom: 18,
          borderWidth: 1,
          borderColor: "#E0EFEB",
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
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {!isGoogleUser ? (
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              }
            }}
            style={[styles.fixedBackButton, { top: insets.top - 30 }]}
          >
            <View style={styles.backButtonCircle}>
              <Ionicons name="chevron-back" size={22} color={APP_TEXT} />
            </View>
          </TouchableOpacity>
        ) : null}

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: 18,
              paddingBottom: 170 + insets.bottom,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
        >
          <View style={styles.headerTitleBlock}>
            <Text style={dynamicStyles.heading}>Personal Setup</Text>
          </View>

          <View style={dynamicStyles.introCard}>
            <Text style={dynamicStyles.introTitle}>
              Tell us about yourself.
            </Text>
          </View>

          {isGoogleUser && (
            <View style={styles.googleWelcomeContainer}>
              <View style={styles.googleWelcomeCard}>
                <View style={styles.googleIconBadge}>
                  <MaterialCommunityIcons
                    name="google"
                    size={16}
                    color={APP_PRIMARY}
                  />
                </View>
                <Text style={dynamicStyles.googleWelcomeText}>
                  Welcome back. Your Google account is connected, so only a few
                  health details are left.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.formWrap}>
            <View style={dynamicStyles.sectionCard}>
              <Text style={dynamicStyles.sectionTitle}>IDENTITY</Text>

              <View style={styles.inputGroup}>
                <Text style={dynamicStyles.label}>Name</Text>
                <View style={dynamicStyles.inputShell}>
                  <MaterialCommunityIcons
                    name="account-outline"
                    size={20}
                    color={APP_TEXT_SOFT}
                  />
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="Enter your name"
                    placeholderTextColor={APP_TEXT_SOFT}
                    value={name}
                    onChangeText={setName}
                  />
                </View>
              </View>

              <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                <Text style={dynamicStyles.label}>Age</Text>
                <View style={dynamicStyles.inputShell}>
                  <MaterialCommunityIcons
                    name="calendar-month-outline"
                    size={20}
                    color={APP_TEXT_SOFT}
                  />
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="Enter your age"
                    placeholderTextColor={APP_TEXT_SOFT}
                    value={age}
                    onChangeText={setAge}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            <View style={dynamicStyles.sectionCard}>
              <Text style={dynamicStyles.sectionTitle}>BODY PROFILE</Text>

              <View style={styles.inputGroup}>
                <Text style={dynamicStyles.label}>Gender</Text>
                <View
                  ref={genderRowRef}
                  style={styles.genderRow}
                  onLayout={measureGenderRow}
                >
                  {genderRowWidth > 0 && (
                    <Animated.View
                      style={[
                        styles.genderSlideBackground,
                        {
                          width: (genderRowWidth - 8 - 12) / 2,
                          transform: [
                            {
                              translateX: genderSlideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [
                                  0,
                                  (genderRowWidth - 8 - 12) / 2 + 12,
                                ],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  )}

                  {genders.map((gender) => (
                    <TouchableOpacity
                      key={gender}
                      style={styles.genderButton}
                      onPress={() => setSelectedGender(gender)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.genderContent}>
                        <MaterialCommunityIcons
                          name={
                            gender === "Male" ? "gender-male" : "gender-female"
                          }
                          size={19}
                          color={
                            selectedGender === gender
                              ? "#FFFFFF"
                              : APP_TEXT_SOFT
                          }
                        />
                        <Text
                          style={
                            selectedGender === gender
                              ? styles.genderTextSelected
                              : styles.genderText
                          }
                        >
                          {gender}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View
                ref={unitToggleRef}
                style={styles.unitToggleContainer}
                onLayout={measureUnitToggle}
              >
                {unitToggleWidth > 0 && (
                  <Animated.View
                    style={[
                      styles.unitSlideBackground,
                      {
                        width: (unitToggleWidth - 8) / 2,
                        transform: [
                          {
                            translateX: unitSlideAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, (unitToggleWidth - 8) / 2],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                )}

                <TouchableOpacity
                  style={styles.unitToggle}
                  onPress={() => setIsMetric(true)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.unitToggleText,
                      isMetric && styles.unitToggleTextActive,
                    ]}
                  >
                    Metric
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.unitToggle}
                  onPress={() => setIsMetric(false)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.unitToggleText,
                      !isMetric && styles.unitToggleTextActive,
                    ]}
                  >
                    Imperial
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.measurementsRow}>
                <View style={dynamicStyles.measurementCard}>
                  <Text style={dynamicStyles.measurementLabel}>Height</Text>
                  <View style={styles.measurementInputWrapper}>
                    <TextInput
                      ref={heightInputRef}
                      style={dynamicStyles.measurementInput}
                      placeholder={isMetric ? "170" : "5.6"}
                      placeholderTextColor={APP_TEXT_SOFT}
                      value={isMetric ? heightCm : heightFt}
                      onChangeText={
                        isMetric ? handleHeightCmChange : handleHeightFtChange
                      }
                      onFocus={handleHeightFocus}
                      keyboardType="numeric"
                    />
                    <Text style={dynamicStyles.measurementUnit}>
                      {isMetric ? "cm" : "ft"}
                    </Text>
                  </View>
                </View>

                <View style={dynamicStyles.measurementCard}>
                  <Text style={dynamicStyles.measurementLabel}>Weight</Text>
                  <View style={styles.measurementInputWrapper}>
                    <TextInput
                      ref={weightInputRef}
                      style={dynamicStyles.measurementInput}
                      placeholder={isMetric ? "70" : "154"}
                      placeholderTextColor={APP_TEXT_SOFT}
                      value={isMetric ? weightKg : weightLbs}
                      onChangeText={
                        isMetric ? handleWeightKgChange : handleWeightLbsChange
                      }
                      onFocus={handleWeightFocus}
                      keyboardType="numeric"
                    />
                    <Text style={dynamicStyles.measurementUnit}>
                      {isMetric ? "kg" : "lbs"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {canShowBMI && (
              <View
                style={[
                  styles.bmiCard,
                  { backgroundColor: bmiTone, borderColor: APP_BORDER },
                ]}
              >
                <View style={styles.bmiTopRow}>
                  <View
                    style={[styles.bmiIconWrap, { backgroundColor: "#FFFFFF" }]}
                  >
                    <MaterialCommunityIcons
                      name="heart-pulse"
                      size={20}
                      color={bmiColor}
                    />
                  </View>
                  <View style={styles.bmiTextContent}>
                    <Text style={styles.bmiLabel}>Body Mass Index</Text>
                    <Text style={styles.bmiHelper}>
                      A quick snapshot based on your current entries.
                    </Text>
                  </View>
                </View>

                <View style={styles.bmiValueBlock}>
                  <Text style={[styles.bmiValue, { color: bmiColor }]}>
                    {bmi}
                  </Text>
                  <View
                    style={[
                      styles.bmiStatusChip,
                      { backgroundColor: "#FFFFFF" },
                    ]}
                  >
                    <View
                      style={[
                        styles.bmiStatusDot,
                        { backgroundColor: bmiColor },
                      ]}
                    />
                    <Text style={[styles.bmiStatus, { color: bmiColor }]}>
                      {bmiStatus}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
          style={[styles.ctaButton, !canContinue && styles.ctaButtonDisabled]}
          disabled={!canContinue}
          onPress={handleContinue}
          activeOpacity={0.88}
        >
          {canContinue ? (
            <View style={styles.buttonActive}>
              <Text style={styles.buttonText}>Continue</Text>
              <MaterialIcons name="arrow-forward" size={22} color="#FFFFFF" />
            </View>
          ) : (
            <View style={styles.buttonDisabled}>
              <Text style={styles.buttonTextDisabled}>
                Complete all fields
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  fixedBackButton: {
    position: "absolute",
    left: 20,
    zIndex: 50,
  },
  headerTitleBlock: {
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 18,
    paddingTop: 8,
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
  googleWelcomeContainer: {
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  googleWelcomeCard: {
    flexDirection: "row",
    backgroundColor: "#EAF5F2",
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D7E9E5",
  },
  googleIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  formWrap: {
    paddingHorizontal: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  genderRow: {
    flexDirection: "row",
    gap: 12,
    position: "relative",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 4,
    borderWidth: 1,
    borderColor: "#D7E9E5",
  },
  genderSlideBackground: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: "#1F4E4A",
    borderRadius: 14,
    zIndex: 0,
  },
  genderButton: {
    flex: 1,
    zIndex: 1,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  genderContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  genderText: {
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: "#6F8C87",
    fontWeight: "700",
  },
  genderTextSelected: {
    fontSize: 15,
    fontFamily: "Lexend-Bold",
    color: "#FFFFFF",
  },
  unitToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 4,
    marginBottom: 20,
    position: "relative",
    borderWidth: 1,
    borderColor: "#D7E9E5",
  },
  unitSlideBackground: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: "#DDF0EC",
    borderRadius: 14,
    zIndex: 0,
  },
  unitToggle: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    zIndex: 1,
  },
  unitToggleText: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: "#6F8C87",
    fontWeight: "700",
  },
  unitToggleTextActive: {
    color: "#1F4E4A",
    fontFamily: "Lexend-Bold",
  },
  measurementsRow: {
    flexDirection: "column",
    gap: 10,
    marginBottom: 2,
  },
  measurementInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bmiCard: {
    borderRadius: 24,
    padding: 18,
    marginTop: 2,
    borderWidth: 1,
    marginBottom: 8,
  },
  bmiTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  bmiIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  bmiTextContent: {
    flex: 1,
  },
  bmiLabel: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: "#173936",
    fontWeight: "800",
    marginBottom: 3,
  },
  bmiHelper: {
    fontSize: 12,
    lineHeight: 18,
    color: "#6F8C87",
    fontFamily: "Manrope-Regular",
  },
  bmiValueBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bmiValue: {
    fontSize: 34,
    fontFamily: "Lexend-Bold",
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  bmiStatusChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  bmiStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  bmiStatus: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    fontWeight: "700",
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 14,
    borderTopWidth: 1,
    width: "100%",
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

export default MiniProfileScreen;