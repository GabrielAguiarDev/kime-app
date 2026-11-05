import { focusManager, MutationCache, QueryClient, type Query } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { haptics } from '@utils/haptics';

// React Native has no window focus: refetch stale queries when the app returns
// to the foreground (e.g. a student whose request was approved meanwhile).
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (state) => {
    if (Platform.OS !== 'web') setFocused(state === 'active');
  });
  return () => subscription.remove();
});

/** While the app is open (foreground), screens on screen re-ask the server this often. */
export const POLL_MS = 15_000;
/** Entering a screen refreshes its data unless it was fetched less than this ago. */
export const REFRESH_MIN_AGE_MS = 5_000;

/**
 * Data that is meant to live long (signed avatar URLs, ~50 min) is neither
 * polled nor refreshed on navigation.
 */
export function isLongLived(query: Query): boolean {
  // staleTime lives on the observer options; the query keeps what was passed.
  const staleTime = (query.options as { staleTime?: unknown }).staleTime;
  return typeof staleTime === 'number' && staleTime > 5 * 60_000;
}

export const queryClient = new QueryClient({
  // DESIGN-SYSTEM.md, section 7: every failed action gives the error haptic,
  // whatever the screen does with the message.
  mutationCache: new MutationCache({
    onError: () => void haptics.error(),
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 60 * 60_000,
      retry: 1,
      // Only queries in use by a mounted screen, and only with the app in the
      // foreground (focusManager above). A query's own refetchInterval wins.
      refetchInterval: (query) => (isLongLived(query) ? false : POLL_MS),
    },
    mutations: {
      retry: 0,
    },
  },
});
