import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

// React Native has no window focus: refetch stale queries when the app returns
// to the foreground (e.g. a student whose request was approved meanwhile).
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (state) => {
    if (Platform.OS !== 'web') setFocused(state === 'active');
  });
  return () => subscription.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 60 * 60_000,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
