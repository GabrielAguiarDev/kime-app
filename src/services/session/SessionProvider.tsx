import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { keyValueStorage, queryClient, StorageKeys, supabase } from '@infra';
import { watchAuthAppState } from '@infra/supabase';

interface SessionContextValue {
  session: Session | null;
  userId: string | undefined;
  /** True until the persisted session has been read at boot. */
  isRestoring: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const wasSignedIn = useRef(false);

  useEffect(() => {
    const stopWatching = watchAuthAppState();
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setIsRestoring(false));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      data.subscription.unsubscribe();
      stopWatching();
    };
  }, []);

  // Everything that belongs to a user dies with their session (sign-out or
  // expired refresh token). Runs as an effect so screens unmount first.
  // So does a pending code (it must never reach the next account). The entry
  // path stays: it is a device preference, not user data.
  useEffect(() => {
    if (session) {
      wasSignedIn.current = true;
      return;
    }
    if (wasSignedIn.current) {
      wasSignedIn.current = false;
      queryClient.clear();
      keyValueStorage.remove(StorageKeys.activeGymId);
      keyValueStorage.remove(StorageKeys.pendingCode);
    }
  }, [session]);

  return (
    <SessionContext.Provider value={{ session, userId: session?.user.id, isRestoring }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
