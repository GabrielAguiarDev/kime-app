import type { ConfigContext, ExpoConfig } from 'expo/config';

import tokens from './tokens.json';

// Google sign-in on iOS: the native sheet returns through the reversed iOS client id
// ("123-abc.apps.googleusercontent.com" → "com.googleusercontent.apps.123-abc").
// Android needs no plugin (no Firebase). Without the env var the plugin stays out:
// with no options it would switch to the Firebase setup (google-services files).
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleSignIn: [string, { iosUrlScheme: string }][] = googleIosClientId
  ? [
      [
        '@react-native-google-signin/google-signin',
        { iosUrlScheme: `com.googleusercontent.apps.${googleIosClientId.replace('.apps.googleusercontent.com', '')}` },
      ],
    ]
  : [];

/**
 * Extends app.json with values that come from tokens.json (single source of truth),
 * so no color is hard-coded in the native config.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    adaptiveIcon: {
      ...config.android?.adaptiveIcon,
      // Background layer of the adaptive icon (the foreground is kimi-icon-light.png at 72%).
      backgroundColor: tokens.color.brand.iconBackground,
    },
  },
  plugins: [
    './plugins/with-cocoapods-project-version',
    ...(config.plugins ?? []),
    'expo-secure-store',
    'expo-sharing',
    ...googleSignIn,
    [
      'expo-splash-screen',
      {
        // Solid dark screen, no logo: the app intro (screens/intro/AppIntro) draws the
        // mascot and hides this splash once it is on screen. The app opens in the dark
        // theme by default, so the splash is dark regardless of the system appearance.
        // The image is a 1x1 fully transparent PNG on purpose: without `image`, the plugin
        // (SDK 58) leaves the iOS storyboard on systemBackgroundColor (white in light mode).
        backgroundColor: tokens.color.dark.bg,
        image: './assets/brand/splash-transparent.png',
      },
    ],
  ],
});
