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
      // Same color as the mascot's body, which fills the icon background.
      backgroundColor: tokens.color.mascot.body,
    },
  },
  plugins: [
    ...(config.plugins ?? []),
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: tokens.size.mascotHero,
        // The app opens in the dark theme by default (the user can change it in Perfil),
        // so the splash is dark regardless of the system appearance.
        backgroundColor: tokens.color.dark.bg,
      },
    ],
  ],
});
