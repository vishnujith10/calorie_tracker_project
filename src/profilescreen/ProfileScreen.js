import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import supabase from "../lib/supabase";
import {
  getResponsiveFontSize,
  getResponsivePadding,
} from "../utils/responsive";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Updated FooterBar with new redesign
const FooterBar = ({ navigation, activeTab, palette, isDark }) => {
  const insets = useSafeAreaInsets();
  const footerStyles = useMemo(
    () => createFooterStyles(palette, isDark),
    [palette, isDark],
  );

  const tabs = [
    {
      key: "Home",
      label: "Home",
      icon: (
        <Ionicons
          name="home-outline"
          size={22}
          color={activeTab === "Home" ? palette.primary : palette.textSecondary}
        />
      ),
      route: "MainDashboard",
    },
    {
      key: "Meals",
      label: "Meals",
      icon: (
        <Ionicons
          name="restaurant-outline"
          size={22}
          color={
            activeTab === "Meals" ? palette.primary : palette.textSecondary
          }
        />
      ),
      route: "Home",
    },
    {
      key: "Workout",
      label: "Workout",
      icon: (
        <Ionicons
          name="barbell-outline"
          size={22}
          color={
            activeTab === "Workout" ? palette.primary : palette.textSecondary
          }
        />
      ),
      route: "Exercise",
    },
    {
      key: "Profile",
      label: "Profile",
      icon: (
        <Ionicons
          name="person-outline"
          size={22}
          color={
            activeTab === "Profile" ? palette.primary : palette.textSecondary
          }
        />
      ),
      route: "Profile",
    },
  ];

  return (
    <View
      style={[
        footerStyles.container,
        {
          bottom:
            insets.bottom >= 20
              ? insets.bottom + getResponsivePadding(14)
              : getResponsivePadding(14),
        },
      ]}
    >
      <View style={footerStyles.ovalFooter}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              footerStyles.tab,
              tab.key === activeTab && footerStyles.activeTab,
            ]}
            onPress={() => {
              if (tab.key === activeTab) return;
              navigation.navigate(tab.route);
            }}
            activeOpacity={0.8}
          >
            <View
              style={[
                footerStyles.iconWrap,
                tab.key === activeTab && footerStyles.activeIconWrap,
              ]}
            >
              {React.cloneElement(tab.icon, {
                color:
                  tab.key === activeTab
                    ? palette.primary
                    : palette.textSecondary,
              })}
            </View>
            <Text
              style={[
                footerStyles.label,
                tab.key === activeTab && footerStyles.activeLabel,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Global cache for ProfileScreen
export const globalProfileCache = {
  lastFetchTime: 0,
  CACHE_DURATION: 300000,
  cachedData: null,
};

const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const palette = useMemo(
    () => createPalette(colors, isDark),
    [colors, isDark],
  );
  const styles = useMemo(
    () => createStyles(palette, isDark),
    [palette, isDark],
  );

  const [userProfile, setUserProfile] = useState(() => {
    const now = Date.now();
    const timeSinceLastFetch = now - globalProfileCache.lastFetchTime;
    const isCacheValid = timeSinceLastFetch < globalProfileCache.CACHE_DURATION;
    return (isCacheValid && globalProfileCache.cachedData?.userProfile) || null;
  });

  const [loading, setLoading] = useState(() => {
    const now = Date.now();
    const timeSinceLastFetch = now - globalProfileCache.lastFetchTime;
    const isCacheValid = timeSinceLastFetch < globalProfileCache.CACHE_DURATION;
    return !(isCacheValid && globalProfileCache.cachedData);
  });

  const [profilePhotoUrl, setProfilePhotoUrl] = useState(() => {
    const now = Date.now();
    const timeSinceLastFetch = now - globalProfileCache.lastFetchTime;
    const isCacheValid = timeSinceLastFetch < globalProfileCache.CACHE_DURATION;
    return (
      (isCacheValid && globalProfileCache.cachedData?.profilePhotoUrl) || null
    );
  });

  const [uploading, setUploading] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const now = Date.now();
      const timeSinceLastFetch = now - globalProfileCache.lastFetchTime;
      const isCacheValid =
        timeSinceLastFetch < globalProfileCache.CACHE_DURATION;

      if (isCacheValid && globalProfileCache.cachedData) {
        const cached = globalProfileCache.cachedData;

        setUserProfile((prev) => {
          const prevStr = JSON.stringify(prev);
          const cachedStr = JSON.stringify(cached.userProfile);
          return prevStr !== cachedStr ? cached.userProfile : prev;
        });

        setProfilePhotoUrl((prev) => {
          return prev !== cached.profilePhotoUrl
            ? cached.profilePhotoUrl
            : prev;
        });

        setLoading(false);
        return;
      }

      await fetchUserProfile();
    };

    loadProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.error("No authenticated user found");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_profile")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        setLoading(false);
        return;
      }

      setUserProfile(data);
      setLoading(false);

      let photoUrl = null;
      if (data.photo_url) {
        try {
          if (!data.photo_url.startsWith("http")) {
            const { data: signedUrlData } = await supabase.storage
              .from("profile-photos")
              .createSignedUrl(data.photo_url, 60 * 60 * 24 * 365 * 10);

            if (signedUrlData?.signedUrl) {
              photoUrl = signedUrlData.signedUrl;
              setProfilePhotoUrl(photoUrl);
            }
          } else {
            photoUrl = data.photo_url;
            setProfilePhotoUrl(photoUrl);
          }
        } catch (error) {
          console.error("Error fetching profile photo:", error);
        }
      }

      globalProfileCache.cachedData = {
        userProfile: data,
        profilePhotoUrl: photoUrl,
      };
      globalProfileCache.lastFetchTime = Date.now();
    } catch (error) {
      console.error("Error in fetchUserProfile:", error);
      setLoading(false);
    }
  };

  const handleProfilePhotoPress = async () => {
    if (userProfile?.photo_url) {
      setImageViewerVisible(true);

      if (!profilePhotoUrl) {
        setImageLoading(true);
        try {
          let photoUrl = null;

          if (!userProfile.photo_url.startsWith("http")) {
            const { data: signedUrlData, error: urlError } =
              await supabase.storage
                .from("profile-photos")
                .createSignedUrl(
                  userProfile.photo_url,
                  60 * 60 * 24 * 365 * 10,
                );

            if (urlError) {
              console.error("Error creating signed URL:", urlError);
              setImageLoading(false);
              return;
            }

            if (signedUrlData?.signedUrl) {
              photoUrl = signedUrlData.signedUrl;
              setProfilePhotoUrl(photoUrl);

              if (globalProfileCache.cachedData) {
                globalProfileCache.cachedData.profilePhotoUrl = photoUrl;
              }
              setImageLoading(false);
            }
          } else {
            photoUrl = userProfile.photo_url;
            setProfilePhotoUrl(photoUrl);
            setImageLoading(false);
          }
        } catch (error) {
          console.error("Error fetching profile photo URL:", error);
          setImageLoading(false);
        }
      }
      return;
    }

    await openImagePicker();
  };

  const openImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        await uploadProfilePhoto(selectedImage.uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      if (
        error.message?.includes("permission") ||
        error.message?.includes("Permission")
      ) {
        Alert.alert(
          "Permission Required",
          "Gallery permission is required. Please enable it in your device settings.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                if (Platform.OS === "ios") {
                  Linking.openURL("app-settings:");
                } else {
                  Linking.openSettings();
                }
              },
            },
          ],
        );
      } else {
        Alert.alert(
          "Error",
          `Failed to pick image: ${error.message || "Please try again."}`,
        );
      }
    }
  };

  const handleEditPhoto = async () => {
    setImageViewerVisible(false);
    await openImagePicker();
  };

  const uploadProfilePhoto = async (imageUri) => {
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "User not logged in");
        return;
      }

      if (userProfile?.photo_url && !userProfile.photo_url.startsWith("http")) {
        try {
          await supabase.storage
            .from("profile-photos")
            .remove([userProfile.photo_url]);
        } catch (error) {
          console.error("Error deleting old photo:", error);
        }
      }

      const fileName = `${user.id}/${Date.now()}.jpg`;

      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(fileName, arrayBuffer, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: updateError } = await supabase
        .from("user_profile")
        .update({ photo_url: fileName })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      const { data: signedUrlData } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10);

      if (signedUrlData?.signedUrl) {
        setProfilePhotoUrl(signedUrlData.signedUrl);
      }

      setUserProfile((prev) => ({ ...prev, photo_url: fileName }));

      globalProfileCache.cachedData = {
        ...globalProfileCache.cachedData,
        userProfile: { ...userProfile, photo_url: fileName },
        profilePhotoUrl: signedUrlData.signedUrl,
      };
      globalProfileCache.lastFetchTime = Date.now();

      Alert.alert("Success", "Profile photo updated successfully!");
    } catch (error) {
      console.error("Error uploading profile photo:", error);
      Alert.alert("Error", `Failed to upload profile photo: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingOrb}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => navigation.navigate("MainDashboard")}
        >
          <Ionicons name="chevron-back" size={20} color={palette.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerEyebrow}>Account</Text>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <View style={styles.headerActionGhost}>
          <Ionicons name="ellipse" size={16} color="transparent" />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{
          paddingBottom: insets.bottom >= 20 ? 130 + insets.bottom : 130,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroKicker}>Wellness profile</Text>
              <Text style={styles.profileName}>
                {userProfile?.name || "User"}
              </Text>
              <Text style={styles.heroSubtext}>
                Manage your account, habits, and connected health preferences.
              </Text>
            </View>

            <View style={styles.avatarShell}>
              <TouchableOpacity
                style={styles.avatar}
                onPress={handleProfilePhotoPress}
                disabled={uploading}
                activeOpacity={profilePhotoUrl ? 0.85 : 1}
              >
                {profilePhotoUrl ? (
                  <Image
                    source={{ uri: profilePhotoUrl }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="person" size={54} color={palette.heroMuted} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cameraButton}
                onPress={handleProfilePhotoPress}
                disabled={uploading}
                activeOpacity={0.85}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                  <Ionicons name="camera" size={16} color={palette.primary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.miniBadgeRow}>
            <View style={styles.miniBadge}>
              <Ionicons
                name="sparkles-outline"
                size={14}
                color={palette.badgeText}
              />
              <Text style={styles.miniBadgeText}>Personalized</Text>
            </View>
            <View style={styles.miniBadge}>
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color={palette.badgeText}
              />
              <Text style={styles.miniBadgeText}>Secure</Text>
            </View>
            <View style={styles.miniBadge}>
              <Ionicons
                name="color-wand-outline"
                size={14}
                color={palette.badgeText}
              />
              <Text style={styles.miniBadgeText}>Customizable</Text>
            </View>
          </View>
        </View>

        <View style={styles.insightStrip}>
          <View style={styles.insightStripIcon}>
            <Ionicons
              name="stats-chart-outline"
              size={18}
              color={palette.primary}
            />
          </View>
          <View style={styles.insightStripTextWrap}>
            <Text style={styles.insightStripTitle}>Profile snapshot</Text>
            <Text style={styles.insightStripSubtitle}>
              Quick overview of your activity and progress.
            </Text>
          </View>
        </View>

        <View style={styles.quickStatsSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Highlights</Text>
            <Text style={styles.sectionHint}>This week</Text>
          </View>

          <View style={styles.featuredStatCard}>
            <View style={styles.featuredStatLeft}>
              <Text style={styles.featuredStatEyebrow}>Consistency</Text>
              <Text style={styles.featuredStatValue}>7 days</Text>
              <Text style={styles.featuredStatText}>
                You are maintaining a healthy rhythm across your recent
                activity.
              </Text>
            </View>
            <View style={styles.featuredStatIconWrap}>
              <Ionicons
                name="flame-outline"
                size={26}
                color={palette.primary}
              />
            </View>
          </View>

         
        </View>

        <View style={styles.settingsWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Manage</Text>
            <Text style={styles.sectionHint}>Preferences and privacy</Text>
          </View>

          <View style={styles.settingsSection}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => navigation.navigate("PersonalInfo")}
              activeOpacity={0.82}
            >
              <View style={styles.settingIconTile}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={palette.primary}
                />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Personal Info</Text>
                <Text style={styles.settingSubtitle}>
                  Name, Email, Birthday
                </Text>
              </View>
              <View style={styles.settingArrowWrap}>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={palette.primary}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => navigation.navigate("Preferences")}
              activeOpacity={0.82}
            >
              <View style={styles.settingIconTile}>
                <Ionicons
                  name="options-outline"
                  size={18}
                  color={palette.primary}
                />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Preferences</Text>
                <Text style={styles.settingSubtitle}>
                  Units, Reminders, Theme
                </Text>
              </View>
              <View style={styles.settingArrowWrap}>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={palette.primary}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => navigation.navigate("AppSettings")}
              activeOpacity={0.82}
            >
              <View style={styles.settingIconTile}>
                <Ionicons
                  name="settings-outline"
                  size={18}
                  color={palette.primary}
                />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>App Settings</Text>
                <Text style={styles.settingSubtitle}>
                  Notifications, AI Insights, Privacy
                </Text>
              </View>
              <View style={styles.settingArrowWrap}>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={palette.primary}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} activeOpacity={0.82}>
              <View style={styles.settingIconTile}>
                <Ionicons
                  name="link-outline"
                  size={18}
                  color={palette.primary}
                />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Connected Devices</Text>
                <Text style={styles.settingSubtitle}>
                  Sync with Apple Health, Google Fit
                </Text>
              </View>
              <View style={styles.settingArrowWrap}>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={palette.primary}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingItem, styles.settingItemLast]}
              activeOpacity={0.82}
            >
              <View style={styles.settingIconTile}>
                <Ionicons
                  name="shield-outline"
                  size={18}
                  color={palette.primary}
                />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Privacy & Security</Text>
                <Text style={styles.settingSubtitle}>Password, 2FA, Data</Text>
              </View>
              <View style={styles.settingArrowWrap}>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={palette.primary}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <FooterBar
        navigation={navigation}
        activeTab="Profile"
        palette={palette}
        isDark={isDark}
      />

      <Modal
        visible={imageViewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setImageViewerVisible(false);
          setImageLoading(false);
        }}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            setImageViewerVisible(false);
            setImageLoading(false);
          }}
        >
          <View style={styles.imageViewerContainer}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.squareModal}>
                <View style={styles.modalTopBar}>
                  <Text style={styles.modalTitle}>Profile photo</Text>
                  <TouchableOpacity
                    style={styles.editButtonInModal}
                    onPress={handleEditPhoto}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons
                          name="create-outline"
                          size={16}
                          color="#FFFFFF"
                        />
                        <Text style={styles.editButtonTextInModal}>Edit</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {imageLoading ? (
                  <View style={styles.squareModalPlaceholder}>
                    <ActivityIndicator size="large" color={palette.primary} />
                    <Text style={styles.loadingImageText}>
                      Loading image...
                    </Text>
                  </View>
                ) : profilePhotoUrl ? (
                  <Image
                    source={{ uri: profilePhotoUrl }}
                    style={styles.squareModalImage}
                    resizeMode="cover"
                    onLoadEnd={() => setImageLoading(false)}
                    onError={(error) => {
                      setImageLoading(false);
                      console.error(
                        "Image load error in modal:",
                        error.nativeEvent?.error || error,
                      );
                      console.error("Failed URL:", profilePhotoUrl);
                    }}
                  />
                ) : (
                  <View style={styles.squareModalPlaceholder}>
                    <Ionicons
                      name="person"
                      size={60}
                      color={palette.textMuted}
                    />
                    <Text style={styles.loadingImageText}>
                      No image available
                    </Text>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const createPalette = (themeColors, isDark) => ({
  background: isDark ? "#0F2422" : "#F4FBFA",
  cardBackground: isDark ? "#173331" : "#FFFFFF",
  surfaceSecondary: isDark ? "#1C3D3A" : "#EEF7F5",
  surfaceTertiary: isDark ? "#214542" : "#E4F1EE",
  textPrimary: isDark ? "#F4FBFA" : "#173A37",
  textSecondary: isDark ? "#B9D7D1" : "#4B6B67",
  textMuted: isDark ? "#89AAA4" : "#7A9792",
  border: isDark ? "rgba(168, 213, 206, 0.16)" : "#D5E8E3",
  primary: "#1F4E4A",
  primarySoft: "#2B6862",
  mint: "#A8D5CE",
  heroTint: isDark ? "#16302D" : "#EAF6F3",
  heroMuted: isDark ? "#A8D5CE" : "#7A9792",
  badgeBg: isDark ? "#214340" : "#E3F2EF",
  badgeText: isDark ? "#D9F0EB" : "#295A55",
  overlay: "rgba(7, 24, 22, 0.68)",
  shadow: "#0A1F1D",
});

const createStyles = (palette, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: getResponsivePadding(20),
      paddingTop: getResponsivePadding(14),
      paddingBottom: getResponsivePadding(12),
      backgroundColor: palette.background,
    },
    headerAction: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: palette.cardBackground,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    headerActionGhost: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    headerCenter: {
      alignItems: "center",
    },
    headerEyebrow: {
      fontSize: getResponsiveFontSize(11),
      color: palette.textMuted,
      fontWeight: "700",
      letterSpacing: 1.1,
      textTransform: "uppercase",
      marginBottom: 2,
    },
    headerTitle: {
      fontSize: getResponsiveFontSize(20),
      fontWeight: "800",
      color: palette.textPrimary,
      letterSpacing: 0.2,
    },

    content: {
      flex: 1,
      paddingHorizontal: getResponsivePadding(20),
    },

    heroCard: {
      backgroundColor: palette.cardBackground,
      borderRadius: 30,
      padding: getResponsivePadding(20),
      borderWidth: 1,
      borderColor: palette.border,
      marginTop: getResponsivePadding(8),
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.28 : 0.08,
      shadowRadius: 24,
      elevation: 4,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    heroTextBlock: {
      flex: 1,
      paddingRight: 16,
    },
    heroKicker: {
      fontSize: getResponsiveFontSize(12),
      color: palette.primary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 8,
    },
    profileName: {
      fontSize: getResponsiveFontSize(28),
      fontWeight: "800",
      color: palette.textPrimary,
      marginBottom: 8,
      lineHeight: 34,
    },
    heroSubtext: {
      fontSize: getResponsiveFontSize(14),
      color: palette.textSecondary,
      lineHeight: 21,
      maxWidth: "95%",
    },

    avatarShell: {
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
    },
    avatar: {
      width: 108,
      height: 108,
      borderRadius: 30,
      backgroundColor: palette.heroTint,
      borderWidth: 1.5,
      borderColor: palette.mint,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImage: {
      width: 108,
      height: 108,
      borderRadius: 30,
    },
    cameraButton: {
      position: "absolute",
      right: -4,
      bottom: -6,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "#F4FBFA",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: palette.mint,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.28 : 0.12,
      shadowRadius: 10,
      elevation: 4,
    },

    heroDivider: {
      height: 1,
      backgroundColor: palette.border,
      marginTop: 18,
      marginBottom: 16,
    },
    miniBadgeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginHorizontal: -4,
    },
    miniBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.badgeBg,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginHorizontal: 4,
      marginTop: 8,
    },
    miniBadgeText: {
      fontSize: getResponsiveFontSize(12),
      color: palette.badgeText,
      fontWeight: "700",
      marginLeft: 6,
    },

    insightStrip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.surfaceSecondary,
      borderRadius: 22,
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginTop: 18,
      borderWidth: 1,
      borderColor: palette.border,
    },
    insightStripIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: palette.cardBackground,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    insightStripTextWrap: {
      flex: 1,
    },
    insightStripTitle: {
      fontSize: getResponsiveFontSize(14),
      color: palette.textPrimary,
      fontWeight: "700",
      marginBottom: 2,
    },
    insightStripSubtitle: {
      fontSize: getResponsiveFontSize(12.5),
      color: palette.textSecondary,
      lineHeight: 18,
    },

    quickStatsSection: {
      marginTop: 24,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: getResponsiveFontSize(21),
      fontWeight: "800",
      color: palette.textPrimary,
      letterSpacing: 0.2,
    },
    sectionHint: {
      fontSize: getResponsiveFontSize(12),
      color: palette.textMuted,
      fontWeight: "600",
    },

    featuredStatCard: {
      backgroundColor: palette.primary,
      borderRadius: 28,
      padding: 18,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    featuredStatLeft: {
      flex: 1,
      paddingRight: 16,
    },
    featuredStatEyebrow: {
      fontSize: getResponsiveFontSize(12),
      color: "#CDE7E2",
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 8,
    },
    featuredStatValue: {
      fontSize: getResponsiveFontSize(30),
      fontWeight: "800",
      color: "#FFFFFF",
      marginBottom: 6,
    },
    featuredStatText: {
      fontSize: getResponsiveFontSize(13),
      color: "#DCEFEB",
      lineHeight: 19,
    },
    featuredStatIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.12)",
      alignItems: "center",
      justifyContent: "center",
    },

    statsGrid: {
      flexDirection: "row",
      marginHorizontal: -6,
    },
    statCard: {
      flex: 1,
      backgroundColor: palette.cardBackground,
      borderRadius: 24,
      padding: 16,
      marginHorizontal: 6,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 18,
      elevation: 2,
    },
    statIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: palette.surfaceSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    statNumber: {
      fontSize: getResponsiveFontSize(24),
      fontWeight: "800",
      color: palette.textPrimary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: getResponsiveFontSize(13),
      color: palette.textSecondary,
      fontWeight: "600",
    },

    settingsWrap: {
      marginTop: 26,
      marginBottom: 8,
    },
    settingsSection: {
      backgroundColor: palette.cardBackground,
      borderRadius: 30,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.22 : 0.06,
      shadowRadius: 20,
      elevation: 3,
    },
    settingItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    settingItemLast: {
      borderBottomWidth: 0,
    },
    settingIconTile: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: palette.surfaceSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    settingText: {
      flex: 1,
    },
    settingTitle: {
      fontSize: getResponsiveFontSize(15.5),
      fontWeight: "700",
      color: palette.textPrimary,
      marginBottom: 3,
    },
    settingSubtitle: {
      fontSize: getResponsiveFontSize(12.5),
      color: palette.textSecondary,
      lineHeight: 17,
    },
    settingArrowWrap: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: palette.surfaceSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 10,
    },

    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: palette.background,
    },
    loadingOrb: {
      width: 78,
      height: 78,
      borderRadius: 26,
      backgroundColor: palette.cardBackground,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.2 : 0.08,
      shadowRadius: 18,
      elevation: 3,
    },
    loadingText: {
      marginTop: 18,
      fontSize: getResponsiveFontSize(15),
      color: palette.textSecondary,
      fontWeight: "600",
    },

    imageViewerContainer: {
      flex: 1,
      backgroundColor: palette.overlay,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 18,
    },
    squareModal: {
      width: SCREEN_WIDTH * 0.88,
      height: SCREEN_WIDTH * 0.98,
      backgroundColor: palette.cardBackground,
      borderRadius: 28,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: isDark ? 0.38 : 0.18,
      shadowRadius: 24,
      elevation: 8,
    },
    modalTopBar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 4,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 14,
      paddingHorizontal: 14,
    },
    modalTitle: {
      fontSize: getResponsiveFontSize(14),
      fontWeight: "700",
      color: "#FFFFFF",
      backgroundColor: "rgba(0,0,0,0.20)",
      overflow: "hidden",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    squareModalImage: {
      width: "100%",
      height: "100%",
    },
    squareModalPlaceholder: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: palette.surfaceSecondary,
    },
    loadingImageText: {
      marginTop: 12,
      fontSize: getResponsiveFontSize(14),
      color: palette.textSecondary,
      fontWeight: "600",
    },
    editButtonInModal: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.primary,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.35 : 0.18,
      shadowRadius: 12,
      elevation: 5,
    },
    editButtonTextInModal: {
      color: "#FFFFFF",
      fontSize: getResponsiveFontSize(13),
      fontWeight: "700",
      marginLeft: 5,
    },
  });

const createFooterStyles = (palette, isDark) =>
  StyleSheet.create({
    container: {
      position: "absolute",
      left: getResponsivePadding(16),
      right: getResponsivePadding(16),
      backgroundColor: "transparent",
      alignItems: "center",
      zIndex: 100,
    },
    ovalFooter: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      backgroundColor: isDark
        ? "rgba(20, 51, 47, 0.96)"
        : "rgba(255, 255, 255, 0.96)",
      borderRadius: 30,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 22,
      elevation: 8,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 6,
    },
    activeTab: {},
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    activeIconWrap: {
      backgroundColor: palette.surfaceSecondary,
    },
    label: {
      fontSize: getResponsiveFontSize(11),
      color: palette.textSecondary,
      fontWeight: "600",
      letterSpacing: 0.2,
    },
    activeLabel: {
      color: palette.primary,
      fontWeight: "800",
    },
  });

export default React.memo(ProfileScreen);
