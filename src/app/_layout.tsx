import { ThemeProvider as RestyleProvider } from '@shopify/restyle';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  SplashScreen,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { queryClient } from '@infra';
import { ActiveGymProvider, useActiveGym } from '@services/activeGym';
import { initAppearance } from '@services/appearance';
import { useConsumePendingInvite } from '@services/useConsumePendingInvite';
import { SessionProvider, useSession } from '@services/session';
import { fontAssets, useSchemeTheme } from '@theme';

SplashScreen.preventAutoHideAsync();
// Apply the saved theme (default dark) before anything renders.
initAppearance();

export default function RootLayout() {
  const theme = useSchemeTheme();
  const scheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: theme.colors.bg,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        primary: theme.colors.accent,
      },
    };
  }, [scheme, theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <RestyleProvider theme={theme}>
        <NavigationThemeProvider value={navigationTheme}>
          <SessionProvider>
            <ActiveGymProvider>
              <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
              <RootNavigator fontsReady={fontsLoaded || !!fontError} />
            </ActiveGymProvider>
          </SessionProvider>
        </NavigationThemeProvider>
      </RestyleProvider>
    </QueryClientProvider>
  );
}

/**
 * "/" (src/app/index.tsx) redirects to the right group. Route access by state:
 *  - signed out                       → (auth)
 *  - signed in, no active gym         → (onboarding)  (create gym / waiting approval)
 *  - signed in, active membership     → (tabs)        (tabs vary by role)
 *  - convite/[token] is always reachable (deep link kimi://convite/<token>)
 */
function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, isRestoring } = useSession();
  const { active, isLoading: membershipsLoading } = useActiveGym();
  useConsumePendingInvite();

  // Gate only the boot. After that the Stack stays mounted; screens show their
  // own loading state (e.g. memberships loading right after sign-in).
  const bootDone = fontsReady && !isRestoring && !membershipsLoading;
  const [booted, setBooted] = useState(false);
  if (bootDone && !booted) setBooted(true);
  const ready = booted || bootDone;

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  const signedIn = !!session;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !active}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !!active}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Screen name="convite/[token]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
