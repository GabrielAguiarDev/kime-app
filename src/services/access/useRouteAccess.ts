import { useMemo } from 'react';

import { useActiveGym } from '../activeGym/ActiveGymProvider';
import { useSession } from '../session/SessionProvider';
import { useAcademySignupFinishing } from './academySignup';
import { routeAccess, type RouteAccess } from './routeAccess';

/** Route access of the current user (see routeAccess). */
export function useRouteAccess(): RouteAccess {
  const { session } = useSession();
  const { active, pending, isStaff, isOwner } = useActiveGym();
  const signedIn = !!session;
  const hasApprovedMembership = !!active;
  const hasPendingRequest = pending.length > 0;
  const finishingSignup = useAcademySignupFinishing();
  return useMemo(
    () => routeAccess({ signedIn, hasApprovedMembership, hasPendingRequest, finishingSignup, isStaff, isOwner }),
    [signedIn, hasApprovedMembership, hasPendingRequest, finishingSignup, isStaff, isOwner],
  );
}
