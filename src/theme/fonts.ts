import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
} from '@expo-google-fonts/barlow';
import {
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed';

/** Font map loaded at boot (see src/app/_layout.tsx). */
export const fontAssets = {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
};

export const fontFamily = {
  regular: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semiBold: 'Barlow_600SemiBold',
  bold: 'Barlow_700Bold',
  condensedBold: 'BarlowCondensed_700Bold',
  condensedExtraBold: 'BarlowCondensed_800ExtraBold',
} as const satisfies Record<string, keyof typeof fontAssets>;
