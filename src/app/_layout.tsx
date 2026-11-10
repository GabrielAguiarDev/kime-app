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
import { useCallback, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { queryClient } from "@infra";
import { useRefreshOnNavigation } from "@infra/query";
import { useNativeHeaderOptions } from "@components";
import { useRouteAccess } from "@services/access";
import { useCountdownWidget } from "@services/competition";
import { useClassReminders } from "@services/reminders";
import { useEventNotifications } from "@services/events";
import { ActiveGymProvider, useActiveGym } from "@services/activeGym";
import { ActiveModalityProvider } from "@services/activeModality";
import { ConfirmProvider } from "@services/confirm";
import { useConsumePendingCode } from "@services/entry";
import { useRecordWaterGoal, useThirstyReminder, useWaterSync, useWidgetConfig } from "@services/water";
import { SessionProvider, useSession } from "@services/session";
import { AppIntro } from "@screens/intro/AppIntro";
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
                <ActiveModalityProvider>
                  <ConfirmProvider>
                    <StatusBar style="light" />
                    <RootNavigator fontsReady={fontsLoaded || !!fontError} />
                  </ConfirmProvider>
                </ActiveModalityProvider>
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
 *  - signed out                                → /sign-in    (entry flow)
 *  - signed in, no approved membership/request → /academia   (code / create academy)
 *  - signed in, a pending request              → /aguardando (waiting screen)
 *  - approved membership                       → /home       (staff/owner screens also check the role)
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
  useRefreshOnNavigation();
  useWaterSync();
  useWidgetConfig();
  useCountdownWidget();
  useRecordWaterGoal();
  useClassReminders();
  useThirstyReminder();

  // Gate only the boot. After that the Stack stays mounted; screens show their
  // own loading state (e.g. memberships loading right after sign-in).
  const bootDone = fontsReady && !isRestoring && !membershipsLoading;
  const [booted, setBooted] = useState(false);
  if (bootDone && !booted) setBooted(true);
  const ready = booted || bootDone;
  useEventNotifications(ready);

  // App intro over the app while it loads, once per cold start (screens/intro/AppIntro).
  // It hides the native splash (background color only) once it is laid out; it needs the
  // fonts for "KIMI".
  const [introDone, setIntroDone] = useState(false);
  const endIntro = useCallback(() => setIntroDone(true), []);

  const redirectTo = access.home;

  return (
    <>
      {ready ? (
        <Stack screenOptions={{ headerShown: false, orientation: 'portrait' }}>
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
            <Stack.Screen name="conta/academias" options={header} />
            <Stack.Screen name="cartel" options={header} />
            <Stack.Screen name="conta/email" options={header} />
            <Stack.Screen name="conta/senha" options={header} />
            <Stack.Screen name="dieta" options={header} />
            <Stack.Screen name="aula" options={header} />
            <Stack.Screen name="relatorio" options={header} />
            <Stack.Screen name="peso" options={header} />
            <Stack.Screen name="disciplina" options={header} />
            <Stack.Screen name="ranking" options={header} />
            {/* Student app: competition (also the countdown widget, kimi://competition), championships, classmates. */}
            <Stack.Screen name="competition" options={header} />
            <Stack.Screen name="campeonato" options={header} />
            <Stack.Screen name="campeonatos" options={header} />
            {/* Academy events: list and detail (members and staff). */}
            <Stack.Screen name="eventos" options={header} />
            <Stack.Screen name="evento/index" options={header} />
            <Stack.Screen name="colega/[userId]" options={header} />
            <Stack.Screen name="agua/widget" options={header} />
            {/* The only screen that may turn landscape (the user's choice, set by the screen). */}
            <Stack.Screen name="timer/run" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          </Stack.Protected>
          <Stack.Protected guard={access.staff} redirectTo={redirectTo}>
            <Stack.Screen name="presenca" options={header} />
            <Stack.Screen name="pedidos" options={header} />
            <Stack.Screen name="member/[membershipId]" options={header} />
            <Stack.Screen name="editar-perfil" options={header} />
            <Stack.Screen name="academy/championships" options={header} />
            <Stack.Screen name="academy/championship" options={header} />
            <Stack.Screen name="evento/editar" options={header} />
            <Stack.Screen name="athlete/water-plan" options={header} />
            <Stack.Screen name="athlete/progress" options={header} />
            <Stack.Screen name="athlete/weight-history" options={header} />
            <Stack.Screen name="athlete/diet" options={header} />
          </Stack.Protected>
          <Stack.Protected guard={access.owner} redirectTo={redirectTo}>
            <Stack.Screen name="academy/settings" options={header} />
            <Stack.Screen name="academy/schedules" options={header} />
            <Stack.Screen name="convites" options={header} />
            <Stack.Screen name="academy/modalities" options={header} />
            <Stack.Screen name="academy/belts" options={header} />
            <Stack.Screen name="academy/belts-order" options={header} />
            {/* Academy finance (owner only; the app never processes payments). */}
            <Stack.Screen name="financeiro/index" options={header} />
            <Stack.Screen name="financeiro/cobrancas" options={header} />
            <Stack.Screen name="financeiro/despesas" options={header} />
            <Stack.Screen name="financeiro/despesa" options={header} />
            <Stack.Screen name="financeiro/relatorios" options={header} />
          </Stack.Protected>
          <Stack.Screen name="entrar" />
        </Stack>
      ) : null}
      {introDone || !fontsReady ? null : <AppIntro ready={ready} onDone={endIntro} />}
    </>
  );
}
