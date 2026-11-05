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
import { useNativeHeaderOptions } from "@components";
import { useRouteAccess } from "@services/access";
import { useCountdownWidget } from "@services/competition";
import { useClassReminders } from "@services/reminders";
import { ActiveGymProvider, useActiveGym } from "@services/activeGym";
import { ConfirmProvider } from "@services/confirm";
import { useConsumePendingCode } from "@services/entry";
import { useRecordWaterGoal, useWaterSync, useWidgetConfig } from "@services/water";
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
 * Route access lives in ONE place: services/access (routeAccess). Every guard
 * below reads it and, when a screen is not allowed (in-app navigation, deep
 * link, widget, notification), redirects to the user's home for their state:
 *  - signed out                         → /start   (entry flow)
 *  - signed in, no approved membership  → /welcome (waiting screen)
 *  - approved membership                → /home    (staff/owner screens also check the role)
 * "/" (src/app/index.tsx) redirects to that same home. `entrar` is part of the
 * entry flow (code → academy confirmation) and stays reachable in every state.
 */
function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { isRestoring } = useSession();
  const { isLoading: membershipsLoading } = useActiveGym();
  const access = useRouteAccess();
  // Inner screens (pushed over the tabs) use the native header; flows (entry, onboarding) do not.
  const header = useNativeHeaderOptions();
  useConsumePendingCode();
  useWaterSync();
  useWidgetConfig();
  useCountdownWidget();
  useRecordWaterGoal();
  useClassReminders();

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

  const redirectTo = access.home;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={access.auth} redirectTo={redirectTo}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={access.onboarding} redirectTo={redirectTo}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={access.app} redirectTo={redirectTo}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="achievement" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        {/* Also opened by the widget (kimi://agua, kimi://agua/configurar). */}
        <Stack.Screen name="agua/index" options={header} />
        <Stack.Screen name="agua/configurar" options={header} />
        <Stack.Screen name="conta/dados" options={header} />
        <Stack.Screen name="dieta" options={header} />
        <Stack.Screen name="ofensivas" options={header} />
        <Stack.Screen name="ranking" options={header} />
        <Stack.Screen name="timer/run" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={access.staff} redirectTo={redirectTo}>
        <Stack.Screen name="presenca" options={header} />
        <Stack.Screen name="pedidos" options={header} />
        <Stack.Screen name="member/[membershipId]" options={header} />
        <Stack.Screen name="academy/championships" options={header} />
        <Stack.Screen name="academy/championship" options={header} />
        <Stack.Screen name="athlete/water-plan" options={header} />
        <Stack.Screen name="athlete/progress" options={header} />
        <Stack.Screen name="athlete/diet" options={header} />
      </Stack.Protected>
      <Stack.Protected guard={access.owner} redirectTo={redirectTo}>
        <Stack.Screen name="academy/settings" options={header} />
        <Stack.Screen name="academy/schedules" options={header} />
        <Stack.Screen name="convites" options={header} />
        <Stack.Screen name="academy/modalities" options={header} />
        <Stack.Screen name="academy/belts" options={header} />
        <Stack.Screen name="academy/belts-order" options={header} />
      </Stack.Protected>
      <Stack.Screen name="entrar" />
    </Stack>
  );
}
