import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const THEME = {
  primary: "#1F4E4A",
  primarySoft: "#2C6661",
  mint: "#A8D5CE",
  mintSoft: "rgba(168, 213, 206, 0.16)",
  mintMedium: "rgba(168, 213, 206, 0.28)",
  mintStrong: "rgba(168, 213, 206, 0.42)",
  dark: "#0C1E1C",
  darkSoft: "rgba(12, 30, 28, 0.82)",
  darkGlass: "rgba(15, 36, 33, 0.56)",
  white: "#F4FBFA",
  whiteSoft: "rgba(244, 251, 250, 0.82)",
  borderLight: "rgba(244, 251, 250, 0.16)",
  textDark: "#163633",
};

export default function CustomCameraScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isGalleryActive, setIsGalleryActive] = useState(false);
  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 2100,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 2100,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.07,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [scanAnim, pulseAnim, glowAnim]);

  const handleCapture = async () => {
    if (cameraRef.current && isCameraReady) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });
        navigation.replace("PhotoCalorieScreen", {
          photoUri: photo.uri,
          mealType: "Quick Log",
        });
      } catch (_error) {
        Alert.alert("Error", "Could not take photo.");
      }
    }
  };

  const handleOpenGallery = async () => {
    try {
      setIsGalleryActive(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        navigation.replace("PhotoCalorieScreen", {
          photoUri: result.assets[0].uri,
          mealType: "Quick Log",
        });
      } else {
        setIsGalleryActive(false);
      }
    } catch (_error) {
      Alert.alert("Error", "Could not open gallery.");
      setIsGalleryActive(false);
    }
  };

  if (!permission) {
    return <View style={styles.loadingContainer} />;
  }

  if (isGalleryActive) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <View style={styles.loadingBadge}>
            <Ionicons name="images-outline" size={22} color={THEME.primary} />
          </View>
          <Text style={styles.loadingTitle}>Opening Gallery</Text>
          <Text style={styles.loadingText}>Preparing your photo picker…</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar style="dark" />
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconWrap}>
            <Ionicons name="camera-outline" size={34} color={THEME.primary} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            Allow camera access to scan meals and estimate calories from photos.
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            style={styles.permissionButton}
          >
            <Text style={styles.permissionButtonText}>Enable Camera</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const scanLineY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [30, width * 0.82 - 34],
  });

  const scanLineOpacity = scanAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.35, 1, 0.35],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.7],
  });
  const takePicture = async () => {
    try {
      if (!cameraRef.current || !isCameraReady) return;

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: false,
      });

      if (photo?.uri) {
        navigation.navigate("PhotoCalorieScreen", {
          imageUri: photo.uri,
        });
      }
    } catch (error) {
      Alert.alert("Camera Error", "Unable to capture image. Please try again.");
    }
  };

  const pickImage = async () => {
    try {
      setIsGalleryActive(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets?.length > 0) {
        navigation.navigate("PhotoCalorieScreen", {
          imageUri: result.assets[0].uri,
        });
      }
    } catch (error) {
      Alert.alert("Gallery Error", "Unable to open gallery. Please try again.");
    } finally {
      setIsGalleryActive(false);
    }
  };
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={() => setIsCameraReady(true)}
      >
        <View style={styles.topOverlay} />
        <View style={styles.bottomOverlay} />

        <View
          style={[
            styles.header,
            { paddingTop: insets.top > 0 ? insets.top + 8 : 18 },
          ]}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.iconButton}
          >
            <Ionicons name="arrow-back" size={22} color={THEME.white} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>Smart meal capture</Text>
            <Text style={styles.headerTitle}>Calorie Scan</Text>
          </View>

          <View style={styles.iconButtonGhost}>
            <Ionicons name="scan-outline" size={20} color={THEME.whiteSoft} />
          </View>
        </View>

        <View style={styles.scanStage}>
          <View style={styles.scanHeaderBadge}>
            <Text style={styles.scanHeaderBadgeText}>AI FRAME</Text>
          </View>

          <View style={styles.scanFrame}>
            <View style={styles.scanFrameTint} />
            <View style={styles.frameCornerTopLeft} />
            <View style={styles.frameCornerTopRight} />
            <View style={styles.frameCornerBottomLeft} />
            <View style={styles.frameCornerBottomRight} />

            <View style={styles.guideCenterWrap}>
              <View style={styles.guideDot} />
            </View>

            <Animated.View
              style={[
                styles.scanLine,
                {
                  opacity: scanLineOpacity,
                  transform: [{ translateY: scanLineY }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.scanGlow,
                {
                  opacity: glowOpacity,
                  transform: [{ translateY: scanLineY }],
                },
              ]}
            />
          </View>
        </View>

        <View
          style={[
            styles.bottomDock,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.bottomDockInner}>
            <View style={styles.sideSpacer} />

            <Animated.View
              style={[
                styles.captureBlock,
                {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.captureButtonOuter}
                onPress={takePicture}
                activeOpacity={0.9}
                disabled={!isCameraReady}
              >
                <View style={styles.captureButtonMiddle}>
                  <View style={styles.captureButtonInner} />
                </View>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              style={styles.sideControl}
              onPress={pickImage}
              activeOpacity={0.85}
              disabled={isGalleryActive}
            >
              <View style={styles.sideIconWrap}>
                <Ionicons
                  name={
                    isGalleryActive ? "hourglass-outline" : "images-outline"
                  }
                  size={22}
                  color={THEME.white}
                />
              </View>
              <Text style={styles.sideLabel}>
                {isGalleryActive ? "Opening" : "Gallery"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.dark,
  },
  camera: {
    flex: 1,
    backgroundColor: THEME.dark,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: THEME.white,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  loadingCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    paddingHorizontal: 28,
    paddingVertical: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D8ECE8",
    shadowColor: "#163633",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 10,
  },
  loadingBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#E8F4F1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: THEME.primary,
    marginBottom: 6,
  },
  loadingText: {
    fontSize: 14,
    color: "#5B7873",
    textAlign: "center",
    lineHeight: 21,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: THEME.white,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  permissionCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 36,
    paddingHorizontal: 28,
    paddingVertical: 34,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D7EAE6",
    shadowColor: "#163633",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
  },
  permissionIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#EAF6F3",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: THEME.primary,
    marginBottom: 8,
    textAlign: "center",
  },
  permissionText: {
    fontSize: 15,
    color: "#4F6D68",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 18,
    minWidth: 180,
    alignItems: "center",
  },
  permissionButtonText: {
    color: THEME.white,
    fontSize: 15,
    fontWeight: "700",
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: THEME.darkSoft,
  },
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 260,
    backgroundColor: "rgba(8, 20, 18, 0.86)",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 18,
    right: 18,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: "rgba(244, 251, 250, 0.12)",
    borderWidth: 1,
    borderColor: THEME.borderLight,
    justifyContent: "center",
    alignItems: "center",
  },
  iconButtonGhost: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: "rgba(244, 251, 250, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 251, 250, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    alignItems: "center",
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.mint,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: THEME.white,
    letterSpacing: 0.3,
  },
  scanStage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 70,
  },
  scanHeaderBadge: {
    position: "absolute",
    top: height * 0.17,
    backgroundColor: "rgba(168, 213, 206, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(168, 213, 206, 0.32)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  scanHeaderBadgeText: {
    color: THEME.white,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  scanFrame: {
    width: width * 0.82,
    height: width * 0.82,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(168, 213, 206, 0.18)",
    backgroundColor: "rgba(244, 251, 250, 0.025)",
  },
  scanFrameTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(168, 213, 206, 0.02)",
  },
  frameCornerTopLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 56,
    height: 56,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 18,
    borderColor: THEME.mint,
  },
  frameCornerTopRight: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 56,
    height: 56,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 18,
    borderColor: THEME.mint,
  },
  frameCornerBottomLeft: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 56,
    height: 56,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 18,
    borderColor: THEME.mint,
  },
  frameCornerBottomRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 56,
    height: 56,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 18,
    borderColor: THEME.mint,
  },
  guideCenterWrap: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
    borderColor: "rgba(168, 213, 206, 0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  guideDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: THEME.mint,
  },
  scanLine: {
    position: "absolute",
    left: 18,
    right: 18,
    height: 4,
    borderRadius: 999,
    backgroundColor: THEME.mint,
    shadowColor: THEME.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 10,
  },
  scanGlow: {
    position: "absolute",
    left: 4,
    right: 4,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(168, 213, 206, 0.32)",
    shadowColor: THEME.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
  },
  instructionCard: {
    marginTop: 24,
    width: width * 0.82,
    borderRadius: 26,
    backgroundColor: THEME.darkGlass,
    borderWidth: 1,
    borderColor: "rgba(168, 213, 206, 0.18)",
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: "center",
  },
  instructionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: THEME.white,
    textAlign: "center",
    marginBottom: 6,
  },
  instructionSubtitle: {
    fontSize: 14,
    color: THEME.whiteSoft,
    textAlign: "center",
    lineHeight: 20,
  },
  tipRow: {
    flexDirection: "row",
    marginTop: 14,
    gap: 10,
  },
  tipPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 6,
  },
  tipPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.primary,
  },
  bottomControls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingHorizontal: 20,
  },
  controlsShell: {
    backgroundColor: "rgba(15, 36, 33, 0.78)",
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(168, 213, 206, 0.16)",
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sideControl: {
    width: 82,
    alignItems: "center",
  },
  sideControlIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "rgba(244, 251, 250, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(244, 251, 250, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  sideControlLabel: {
    marginTop: 9,
    fontSize: 12,
    fontWeight: "700",
    color: THEME.whiteSoft,
  },
  captureBlock: {
    alignItems: "center",
    marginTop: -28,
  },
  captureOuterRing: {
    width: 112,
    height: 112,
    borderRadius: 36,
    backgroundColor: THEME.mintSoft,
    borderWidth: 1,
    borderColor: THEME.mintMedium,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 10,
  },
  captureButton: {
    width: 90,
    height: 90,
    borderRadius: 30,
    backgroundColor: THEME.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#D8ECE8",
  },
  captureInnerPanel: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: "#EAF6F3",
    justifyContent: "center",
    alignItems: "center",
  },
  captureLabel: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "800",
    color: THEME.white,
    letterSpacing: 0.4,
  },
  bottomDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 30,
    backgroundColor: "transparent",
    borderTopWidth: 1,
    borderTopColor: THEME.borderLight,
  },

  bottomDockInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sideSpacer: {
    width: 76,
    height: 76,
  },

  sideIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: THEME.darkGlass,
    borderWidth: 1,
    borderColor: THEME.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },

  sideLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: THEME.whiteSoft,
    letterSpacing: 0.3,
  },

  captureButtonOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(244, 251, 250, 0.16)",
    borderWidth: 1.5,
    borderColor: "rgba(244, 251, 250, 0.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  captureButtonMiddle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: THEME.white,
    alignItems: "center",
    justifyContent: "center",
  },

  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: THEME.primary,
    borderWidth: 4,
    borderColor: THEME.mint,
  },
});
