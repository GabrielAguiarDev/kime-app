import { useTheme } from '@shopify/restyle';
import { darkTheme, type Theme } from './theme';

export * from './theme';
export { fontAssets, fontFamily } from './fonts';
export { tokens } from './tokens';

export const useAppTheme = () => useTheme<Theme>();

/**
 * The app is dark only (user decision). `lightTheme` stays in ./theme so a
 * light mode can come back later without touching the tokens.
 */
export function useSchemeTheme(): Theme {
  return darkTheme;
}

/** True when the dark theme is active (always, while the app is dark only). */
export function useIsDark(): boolean {
  return true;
}
