import { useTheme } from '@shopify/restyle';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type Theme } from './theme';

export * from './theme';
export { fontAssets, fontFamily } from './fonts';
export { tokens } from './tokens';

export const useAppTheme = () => useTheme<Theme>();

/** Theme for the current system appearance (light/dark follow the OS setting). */
export function useSchemeTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

/** True when the dark theme is active. */
export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
