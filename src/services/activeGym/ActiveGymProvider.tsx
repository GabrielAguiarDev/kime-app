import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  resolveActiveMembership,
  useMyMemberships,
  type Membership,
  type MembershipRole,
} from '@domain/Membership';
import { keyValueStorage, StorageKeys } from '@infra';

import { useSession } from '../session/SessionProvider';

interface ActiveGymContextValue {
  memberships: Membership[];
  /** Active membership the app is showing. Null = onboarding. */
  active: Membership | null;
  role: MembershipRole | null;
  pending: Membership[];
  /** First load only (no data yet). */
  isLoading: boolean;
  /** Any request in flight, including background refetch. */
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
  selectGym: (gymId: string) => void;
}

const ActiveGymContext = createContext<ActiveGymContextValue | null>(null);

export function ActiveGymProvider({ children }: { children: ReactNode }) {
  const { userId } = useSession();
  const { data, isLoading, isFetching, isError, refetch } = useMyMemberships(userId);
  const [storedGymId, setStoredGymId] = useState(() => keyValueStorage.get(StorageKeys.activeGymId));

  // User changed (sign-out / another account): re-read the choice. Storage was
  // cleared by SessionProvider on sign-out, so the next user starts fresh.
  const [prevUserId, setPrevUserId] = useState(userId);
  if (userId !== prevUserId) {
    setPrevUserId(userId);
    setStoredGymId(userId ? keyValueStorage.get(StorageKeys.activeGymId) : null);
  }

  const selectGym = useCallback((gymId: string) => {
    keyValueStorage.set(StorageKeys.activeGymId, gymId);
    setStoredGymId(gymId);
  }, []);

  const value = useMemo<ActiveGymContextValue>(() => {
    const memberships = data ?? [];
    const active = resolveActiveMembership(memberships, storedGymId);
    return {
      memberships,
      active,
      role: active?.role ?? null,
      pending: memberships.filter((m) => m.status === 'pending'),
      isLoading: !!userId && isLoading,
      isFetching,
      isError,
      refetch: () => void refetch(),
      selectGym,
    };
  }, [data, storedGymId, userId, isLoading, isFetching, isError, refetch, selectGym]);

  return <ActiveGymContext.Provider value={value}>{children}</ActiveGymContext.Provider>;
}

export function useActiveGym(): ActiveGymContextValue {
  const ctx = useContext(ActiveGymContext);
  if (!ctx) throw new Error('useActiveGym must be used inside ActiveGymProvider');
  return ctx;
}
