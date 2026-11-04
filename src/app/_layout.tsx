import { ThemeProvider as RestyleProvider } from "@shopify/restyle";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import {
  DarkTheme,
  SplashScreen,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { queryClient } from "@infra";
import { ActiveGymProvider, useActiveGym } from "@services/activeGym";
import { ConfirmProvider } from "@services/confirm";
import { useConsumePendingCode } from "@services/entry";
import { useWaterSync, useWidgetConfig } from "@services/water";
import { SessionProvider, useSession } from "@services/session";
import { fontAssets, useSchemeTheme } from "@theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useSchemeTheme();
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  const navigationTheme = useMemo(() => {
    return {
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        background: theme.colors.bg,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        primary: theme.colors.accent,
      },
    };
  }, [theme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <RestyleProvider theme={theme}>
          <NavigationThemeProvider value={navigationTheme}>
            <SessionProvider>
              <ActiveGymProvider>
                <ConfirmProvider>
                  <StatusBar style="light" />
                  <RootNavigator fontsReady={fontsLoaded || !!fontError} />
                </ConfirmProvider>
              </ActiveGymProvider>
            </SessionProvider>
          </NavigationThemeProvider>
        </RestyleProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/**
 * "/" (src/app/index.tsx) redirects to the right group. Route access by state:
 *  - signed out                       → (auth)
 *  - signed in, no active gym         → (onboarding)  (create gym / waiting approval)
 *  - signed in, active membership     → (tabs)        (tabs vary by role)
 *  - entrar is always reachable: code → academy confirmation, signed in or
 *    out (deep link kimi://entrar?codigo=XXXXXXXX)
 */
function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, isRestoring } = useSession();
  const { active, isOwner, isStaff, isLoading: membershipsLoading } = useActiveGym();
  useConsumePendingCode();
  useWaterSync();
  useWidgetConfig();

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
        <Stack.Screen name="achievement" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack.Protected>
      {/* Water (everyone signed in): also opened by the widget (kimi://agua, kimi://agua/configurar). */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="agua/index" />
        <Stack.Screen name="agua/configurar" />
        <Stack.Screen name="agua/widget" />
      </Stack.Protected>
      {/* Staff screens, pushed from the tabs. */}
      <Stack.Protected guard={signedIn && isStaff}>
        <Stack.Screen name="academy/schedules" />
        <Stack.Screen name="member/[membershipId]" />
      </Stack.Protected>
      {/* Owner only: academy settings (name, logo, codes) and belt goals. */}
      <Stack.Protected guard={signedIn && isOwner}>
        <Stack.Screen name="academy/settings" />
        <Stack.Screen name="academy/belts" />
      </Stack.Protected>
      <Stack.Screen name="entrar" />
    </Stack>
  );
}
