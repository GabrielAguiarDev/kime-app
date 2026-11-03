import {
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed';
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

import { tokens } from './tokens';

/** Font map loaded at boot (see src/app/_layout.tsx). Keys are the family names used in tokens.json. */
export const fontAssets = {
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
};

/** Font families from tokens.json — the type check fails if a token names a font that isn't loaded. */
export const fontFamily: Record<keyof typeof tokens.font.family, keyof typeof fontAssets> =
  tokens.font.family;
