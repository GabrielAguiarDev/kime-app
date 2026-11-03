import { useTheme } from '@shopify/restyle';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type Theme } from './theme';

export * from './theme';
export { fontAssets, fontFamily } from './fonts';

export const useAppTheme = () => useTheme<Theme>();

/** Theme for the current system appearance. */
export function useSchemeTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}
