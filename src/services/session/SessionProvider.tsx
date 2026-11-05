import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { countdownWidget } from '@domain/Competition';
import { waterService } from '@domain/Water';
import { keyValueStorage, queryClient, StorageKeys, supabase } from '@infra';
import { watchAuthAppState } from '@infra/supabase';

/**
 * Everything of a user kept on the device: query cache, preferences scoped to
 * them, the active academy, a pending code, and what the widgets read (synced
 * water logs and config, championships countdown; unsynced water stays). The entry path stays: it is a
 * device preference, not user data.
 */
function clearLocalUserData(userId: string | undefined) {
  queryClient.clear();
  keyValueStorage.remove(StorageKeys.activeGymId);
  keyValueStorage.remove(StorageKeys.pendingCode);
  if (userId) {
    keyValueStorage.removeUserScoped(userId);
    void waterService.clearDevice(userId);
  }
  countdownWidget.publish(null);
  countdownWidget.publishModality(null);
}

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
  const signedInUser = useRef<string | null>(null);

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

  // Everything that belongs to a user dies with their session ("Sair da
  // conta" or an expired refresh token), including what the widgets show.
  // Runs as an effect so screens unmount first; the guard then shows /start.
  useEffect(() => {
    if (session) {
      signedInUser.current = session.user.id;
      return;
    }
    if (signedInUser.current !== null) {
      const userId = signedInUser.current;
      signedInUser.current = null;
      clearLocalUserData(userId);
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
