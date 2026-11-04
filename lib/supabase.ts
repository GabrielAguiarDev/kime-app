import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from '../src/infra/env';
import { secureSessionStorage } from '../src/infra/storage/secureSessionStorage';
import type { Database } from '../src/infra/supabase/database.types';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    // Native sessions, including large tokens, live only in SecureStore.
    // Web uses memory until a browser persistence strategy is provided.
    storage: Platform.OS === 'web' ? undefined : secureSessionStorage,
    storageKey: 'kimi.supabase.auth.v1',
    autoRefreshToken: true,
    persistSession: Platform.OS !== 'web',
    detectSessionInUrl: false,
    // No `lock`: since supabase-js 2.118 the client coordinates refreshes by itself.
  },
});

/** Owned by SessionProvider, with initial state and unmount cleanup. */
export function watchAuthAppState(): () => void {
  if (Platform.OS === 'web') return () => undefined;
  const update = (state: string | null | undefined) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  };
  update(AppState.currentState);
  const subscription = AppState.addEventListener('change', update);
  return () => {
    subscription.remove();
    supabase.auth.stopAutoRefresh();
  };
}
