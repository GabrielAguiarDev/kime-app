import type { ConfigContext, ExpoConfig } from 'expo/config';

import tokens from './tokens.json';

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
    ...(config.plugins ?? []),
    'expo-secure-store',
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
