import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { supabase } from './supabase';

type State =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'notAdmin'; session: Session }
  | { kind: 'error'; session: Session; error: unknown }
  | { kind: 'admin'; session: Session };

const SessionContext = createContext<State>({ kind: 'loading' });
export const useSession = () => useContext(SessionContext);

/** signed out → login; signed in → is this account an admin (the database list)? */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let admin: { userId: string; isAdmin: boolean } | null = null;

    async function resolve(session: Session | null) {
      if (!session) {
        admin = null;
        setState({ kind: 'signedOut' });
        return;
      }
      try {
        // Token refreshes keep the same user: ask the database once per user.
        if (admin?.userId !== session.user.id) {
          setState({ kind: 'loading' });
          admin = { userId: session.user.id, isAdmin: await api.isAdmin() };
        }
        setState(admin.isAdmin ? { kind: 'admin', session } : { kind: 'notAdmin', session });
      } catch (error) {
        admin = null;
        setState({ kind: 'error', session, error });
      }
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Never await Supabase calls inside this callback (it holds the auth lock).
      setTimeout(() => void resolve(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}
