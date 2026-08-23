# Expo Production Build Commands

## Prerequisites

1. **Install EAS CLI globally** (if not already installed):
```bash
npm install -g eas-cli
```

2. **Login to your Expo account**:
```bash
eas login
```

## Build Commands

### Android Production Build (APK)

```bash
eas build --platform android --profile production
```

**Or for Android App Bundle (AAB) - required for Google Play Store:**
```bash
eas build --platform android --profile production --type app-bundle
```

### iOS Production Build

```bash
eas build --platform ios --profile production
```

### Build for Both Platforms

```bash
eas build --platform all --profile production
```

## Additional Options

### Build Locally (instead of EAS cloud)

**Android:**
```bash
eas build --platform android --profile production --local
```

**iOS:**
```bash
eas build --platform ios --profile production --local
```

### Build with Specific Environment Variables

If you need to override environment variables for a specific build:
```bash
eas build --platform android --profile production --env EXPO_PUBLIC_SUPABASE_URL="your-url"
```

### Check Build Status

```bash
eas build:list
```

### Download Build

After build completes, download it:
```bash
eas build:download
```

## Quick Reference

| Platform | Command | Output |
|----------|---------|--------|
| Android APK | `eas build --platform android --profile production` | APK file |
| Android AAB | `eas build --platform android --profile production --type app-bundle` | AAB file (for Play Store) |
| iOS | `eas build --platform ios --profile production` | IPA file |
| Both | `eas build --platform all --profile production` | Both APK/AAB and IPA |

## Notes

- **Android APK**: Can be installed directly on devices
- **Android AAB**: Required for Google Play Store submission
- **iOS IPA**: Requires Apple Developer account and certificates
- Builds are processed in the cloud by default (faster, no local setup needed)
- First build may take longer (15-30 minutes)
- Subsequent builds are usually faster (10-15 minutes)

## Troubleshooting

If you encounter issues:

1. **Check EAS CLI version:**
```bash
eas --version
```

2. **Update EAS CLI:**
```bash
npm update -g eas-cli
```

3. **Check build configuration:**
```bash
eas build:configure
```

4. **View build logs:**
```bash
eas build:view
```
