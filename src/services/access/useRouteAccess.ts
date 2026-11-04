import { useMemo } from 'react';

import { useActiveGym } from '../activeGym/ActiveGymProvider';
import { useSession } from '../session/SessionProvider';
import { routeAccess, type RouteAccess } from './routeAccess';

/** Route access of the current user (see routeAccess). */
export function useRouteAccess(): RouteAccess {
  const { session } = useSession();
  const { active, isStaff, isOwner } = useActiveGym();
  const signedIn = !!session;
  const hasApprovedMembership = !!active;
  return useMemo(
    () => routeAccess({ signedIn, hasApprovedMembership, isStaff, isOwner }),
    [signedIn, hasApprovedMembership, isStaff, isOwner],
  );
}
