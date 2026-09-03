import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import supabase from "../lib/supabase";

const EMOJIS = ["😊", "😐", "😔", "😭", "😭"];

// Shared palette — mirrors the teal design system used across the app
// (Home dashboard, Weight Tracker, Voice Calorie screen, etc.)
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
  placeholder: isDark ? "#6E938D" : "#9BB8B3",
  border: isDark ? "#2C4A46" : "#D5E8E3",
  borderStrong: isDark ? "#466963" : "#BFD8D3",
  shadow: "#102624",
  chipBackground: isDark ? "#1F3A36" : "#EAF4F2",
  chipText: isDark ? "#D7ECE8" : "#476560",
  destructive: "#B94F4F",
});

const AddWeightScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const palette = useMemo(() => createPalette(isDark), [isDark]);
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [newWeight, setNewWeight] = useState("");
  const [newPhoto, setNewPhoto] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [newEmoji, setNewEmoji] = useState(EMOJIS[0]);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userWeightUnit, setUserWeightUnit] = useState("kg");

  useEffect(() => {
    const getUserId = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id || null;
      setUserId(uid);

      // Fetch user's weight unit from profile
      if (uid) {
        const { data: profile } = await supabase
          .from("user_profile")
          .select("weight_unit")
          .eq("id", uid)
          .single();
        if (profile?.weight_unit) {
          setUserWeightUnit(profile.weight_unit);
        }
      }
    };
    getUserId();
  }, []);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setNewPhoto(result.assets[0]);
    }
  }

  async function handleAddWeight() {
    const cleanedWeight = newWeight.replace(/\s|\u00A0/g, "").replace(",", ".");
    console.log(
      "newWeight:",
      newWeight,
      "cleanedWeight:",
      cleanedWeight,
      "Number(cleanedWeight):",
      Number(cleanedWeight),
    );
    if (
      !userId ||
      !cleanedWeight ||
      isNaN(Number(cleanedWeight)) ||
      Number(cleanedWeight) <= 0
    ) {
      Alert.alert("Missing info", "Please enter your weight.");
      return;
    }
    setUploading(true);
    let photo_url = null;
    if (newPhoto) {
      const fileName = `${userId}/${Date.now()}.jpg`;
      const supabaseUrl = 'https://tkuyjtdycmmkvunurlxj.supabase.co';
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      if (!authToken) {
        setUploading(false);
        Alert.alert("Photo upload failed", "Not authenticated. Please log in again.");
        return;
      }
      const uploadResult = await FileSystem.uploadAsync(
        `${supabaseUrl}/storage/v1/object/weight-photos/${fileName}`,
        newPhoto.uri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: `Bearer ${authToken}`,
            apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrdXlqdGR5Y21ta3Z1bnVybHhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzIwMDYsImV4cCI6MjA4OTQwODAwNn0.Vs1fjhWuGK93s2vbe3mcj-nLQaCcKXGVQW3LjnpD2VY',
            'Content-Type': 'image/jpeg',
            'x-upsert': 'false',
          },
        }
      );
      if (uploadResult.status !== 200) {
        setUploading(false);
        Alert.alert("Photo upload failed", `Upload error: ${uploadResult.body}`);
        return;
      }
      photo_url = fileName; // Store path; WeightTrackerScreen generates signed URLs on display
    }
    const today = new Date().toISOString().slice(0, 10);
    let weightValue = parseFloat(cleanedWeight);
    // Convert to kg if user's unit is lbs
    if (userWeightUnit === "lbs")
      weightValue = (weightValue / 2.20462).toFixed(2);
    const { data: insertData, error: insertError } = await supabase
      .from("weight_logs")
      .insert([
        {
          user_id: userId,
          date: today,
          weight: weightValue,
          note: newNote,
          emoji: newEmoji,
          photo_url,
        },
      ]);
    console.log("Insert result:", insertData, insertError);
    if (insertError) {
      setUploading(false);
      Alert.alert("Error", insertError.message);
      return;
    }

    // Update user_profile table with the new weight
    const { error: profileError } = await supabase
      .from("user_profile")
      .update({
        weight: weightValue,
      })
      .eq("id", userId);

    if (profileError) {
      console.log("Profile update error:", profileError);
      // Don't show error to user as the weight log was saved successfully
    }

    // Optimistic update - update WeightTrackerScreen cache immediately
    try {
      const { getMainDashboardCache } = require("../utils/cacheManager");
      const mainCache = getMainDashboardCache();
      if (mainCache.cachedData) {
        // Update weight in MainDashboard cache for Weight Journey card
        mainCache.cachedData.currentWeight = weightValue;
        mainCache.lastFetchTime = Date.now();
      }

      // Update WeightTrackerScreen cache
      let displayPhotoUrl = null;
      if (photo_url) {
        // Generate a signed URL for immediate display in the tracker
        try {
          const { data: signedData } = await supabase.storage
            .from('weight-photos')
            .createSignedUrl(photo_url, 60 * 60 * 24 * 7);
          displayPhotoUrl = signedData?.signedUrl || null;
        } catch (_) {}
      }

      const newLog = {
        user_id: userId,
        date: today,
        weight: weightValue,
        note: newNote,
        emoji: newEmoji,
        photo_url: displayPhotoUrl, // use signed URL in cache, not raw path
      };

      // Access the global cache from WeightTrackerScreen
      const globalWeightCache =
        require("./WeightTrackerScreen").globalWeightCache;
      if (globalWeightCache) {
        globalWeightCache.cachedData = {
          ...globalWeightCache.cachedData,
          logs: [newLog, ...(globalWeightCache.cachedData?.logs || [])],
          userProfile: {
            ...globalWeightCache.cachedData?.userProfile,
            weight: weightValue,
          },
        };
        // Invalidate timestamp so WeightTrackerScreen re-fetches fresh data on focus
        globalWeightCache.lastFetchTime = 0;
      }
    } catch (error) {
      // Silent - cache might not exist yet
    }

    setUploading(false);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.modalFullBg}>
      {/* Custom Header */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate("WeightTrackerScreen")}
            style={styles.heroBackBtn}
          >
            <Ionicons name="chevron-back" size={22} color={palette.primary} />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Add New Weight</Text>
          <View style={styles.heroSpacer} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionEyebrow}>Today&apos;s entry</Text>
        <View style={styles.weightInputWrap}>
          <TextInput
            style={styles.weightInput}
            placeholder={`Enter your weight (${userWeightUnit})`}
            placeholderTextColor={palette.placeholder}
            keyboardType="decimal-pad"
            value={newWeight}
            onChangeText={(text) => setNewWeight(text.replace(/[^0-9.,]/g, ""))}
          />
          <View style={styles.weightUnitChip}>
            <Text style={styles.weightUnitChipText}>{userWeightUnit}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Add a progress photo</Text>
        <View style={styles.photoUploadBoxDashed}>
          {newPhoto ? (
            <TouchableOpacity onPress={pickPhoto}>
              <Image
                source={{ uri: newPhoto.uri }}
                style={styles.uploadedPhoto}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.uploadBoxInner}
              onPress={pickPhoto}
              activeOpacity={0.85}
            >
              <View style={styles.uploadIconShell}>
                <Ionicons
                  name="camera-outline"
                  size={24}
                  color={palette.primary}
                />
              </View>
              <Text style={styles.uploadPhotoTitle}>Upload a photo</Text>
              <Text style={styles.uploadPhotoDesc}>
                Add a photo to track your progress
              </Text>
              <View style={styles.uploadBtn}>
                <Text style={styles.uploadBtnText}>Upload</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionLabel}>How are you feeling?</Text>
        <View style={styles.emojiRow}>
          {EMOJIS.map((e, idx) => (
            <TouchableOpacity
              key={e + idx}
              onPress={() => setNewEmoji(e)}
              style={[
                styles.emojiPill,
                newEmoji === e && styles.emojiPillActive,
              ]}
            >
              <Text style={styles.emoji}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Notes</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="Add a note (optional)"
          placeholderTextColor={palette.placeholder}
          value={newNote}
          onChangeText={setNewNote}
          multiline
        />
      </ScrollView>
      <TouchableOpacity
        style={styles.saveBtnFull}
        onPress={handleAddWeight}
        disabled={uploading}
        activeOpacity={0.9}
      >
        {!uploading && (
          <Ionicons
            name="checkmark-circle-outline"
            size={20}
            color="#FFFFFF"
            style={{ marginRight: 8 }}
          />
        )}
        <Text style={styles.saveBtnTextFull}>
          {uploading ? "Saving..." : "Save"}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const createStyles = (palette) =>
  StyleSheet.create({
    modalFullBg: { flex: 1, backgroundColor: palette.background },

    // Header
    heroCard: {
      paddingHorizontal: 26,
      paddingTop: 8,
      paddingBottom: 6,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    heroBackBtn: {
      width: 40,
      height: 40,
      borderRadius: 16,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      justifyContent: "center",
    },
    heroTitle: {
      fontSize: 19,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },
    heroSpacer: { width: 40 },

    scrollContent: { padding: 24, paddingBottom: 32 },

    sectionEyebrow: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.9,
      marginBottom: 8,
    },

    weightInputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: palette.border,
      paddingHorizontal: 6,
      marginBottom: 16,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    weightInput: {
      flex: 1,
      borderWidth: 0,
      backgroundColor: "transparent",
      borderRadius: 16,
      padding: 16,
      fontFamily: "Lexend-Bold",
      fontSize: 22,
      color: palette.textPrimary,
    },
    weightUnitChip: {
      backgroundColor: palette.cardSecondary,
      borderRadius: 14,
      paddingVertical: 8,
      paddingHorizontal: 14,
      marginRight: 8,
      borderWidth: 1,
      borderColor: palette.border,
    },
    weightUnitChipText: {
      fontFamily: "Lexend-SemiBold",
      fontSize: 13,
      color: palette.primary,
    },

    sectionLabel: {
      fontSize: 17,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
      marginBottom: 10,
      marginTop: 20,
    },

    photoUploadBoxDashed: {
      borderWidth: 1.5,
      borderColor: palette.borderStrong,
      borderStyle: "dashed",
      borderRadius: 24,
      padding: 24,
      backgroundColor: palette.cardSecondary,
      alignItems: "center",
    },
    uploadBoxInner: { justifyContent: "center", alignItems: "center" },
    uploadIconShell: {
      width: 48,
      height: 48,
      borderRadius: 18,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
      marginBottom: 10,
    },
    uploadedPhoto: {
      width: 120,
      height: 120,
      borderRadius: 20,
      marginVertical: 4,
    },
    uploadPhotoTitle: {
      fontSize: 17,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
      marginBottom: 4,
      textAlign: "center",
    },
    uploadPhotoDesc: {
      fontSize: 13,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
      textAlign: "center",
      marginBottom: 14,
    },
    uploadBtn: {
      paddingVertical: 10,
      paddingHorizontal: 22,
      backgroundColor: palette.primary,
      borderRadius: 16,
      minWidth: 100,
      alignItems: "center",
    },
    uploadBtnText: {
      color: "#FFFFFF",
      fontFamily: "Lexend-SemiBold",
      fontSize: 14,
    },

    emojiRow: { flexDirection: "row", justifyContent: "space-between" },
    emojiPill: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.card,
    },
    emojiPillActive: {
      backgroundColor: palette.cardSecondary,
      borderColor: palette.primary,
    },
    emoji: { fontSize: 26 },

    noteInput: {
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.card,
      borderRadius: 20,
      padding: 16,
      fontFamily: "Manrope-Regular",
      fontSize: 15,
      color: palette.textPrimary,
      width: "100%",
      minHeight: 90,
      textAlignVertical: "top",
    },

    saveBtnFull: {
      flexDirection: "row",
      backgroundColor: palette.primary,
      borderRadius: 26,
      paddingVertical: 17,
      alignItems: "center",
      justifyContent: "center",
      width: "90%",
      alignSelf: "center",
      marginBottom: 24,
      marginTop: 8,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 6,
    },
    saveBtnTextFull: {
      color: "#FFFFFF",
      fontFamily: "Lexend-Bold",
      fontSize: 18,
    },
  });

export default AddWeightScreen;
