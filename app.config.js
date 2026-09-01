import "dotenv/config";
export default {
  expo: {
    name: "Calora",
    slug: "calora",
    owner: "vishnu242552",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    scheme: "calora",
    icon: "./assets/logo/logo.png",
    newArchEnabled: true,
    splash: {
      image: "./assets/logo/logo.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.calora.app",
      infoPlist: {
        NSPhotoLibraryUsageDescription:
          "Allow Calora to access your photos to analyze food images.",
        NSCameraUsageDescription:
          "Allow Calora to access your camera to take food photos.",
        NSMicrophoneUsageDescription:
          "Allow Calora to access your microphone for voice food descriptions.",
        NSSpeechRecognitionUsageDescription:
          "We transcribe your speech to text.",
      },
    },
    android: {
      package: "com.calora.app",
      adaptiveIcon: {
        foregroundImage: "./assets/logo/logo.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "RECORD_AUDIO",
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      EXPO_PUBLIC_GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
      eas: {
        projectId: "f96f8480-5291-458b-aa94-fe04125b0bdd",
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      supabaseServiceRoleKey: process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
    },
    plugins: [
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme:
            "com.googleusercontent.apps.487994715483-j33a3187nft4jesfklviunp5fkt1fq7l",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/logo/logo.png",
          color: "#7C3AED",
          sounds: [],
        },
      ],
      "expo-system-ui",
      "expo-web-browser",
      [
        "expo-audio",
        {
          microphonePermission:
            "Allow Calora to access your microphone for voice food descriptions.",
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            enableProguardInReleaseBuilds: false,
            enableShrinkResourcesInReleaseBuilds: false,
            useAndroidX: true,
            enableJetifier: true,
            compileSdkVersion: 35,
            targetSdkVersion: 34,
            buildToolsVersion: "35.0.0",
            packagingOptions: {
              exclude: [
                "META-INF/DEPENDENCIES",
                "META-INF/LICENSE",
                "META-INF/LICENSE.txt",
                "META-INF/license.txt",
                "META-INF/NOTICE",
                "META-INF/NOTICE.txt",
                "META-INF/notice.txt",
                "META-INF/ASL2.0",
              ],
            },
          },
        },
      ],
      "expo-secure-store",
    ],
  },
};
