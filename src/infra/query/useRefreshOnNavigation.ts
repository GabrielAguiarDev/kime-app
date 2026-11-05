import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { isLongLived, queryClient, REFRESH_MIN_AGE_MS } from './queryClient';

/**
 * Entering a screen asks the server again for the data in use. Tab screens
 * stay mounted, so without this a tab kept showing what it loaded first (e.g.
 * a professor not seeing a new join request until the app restarted).
 * Refetches every ACTIVE query (mounted screens) not fetched in the last
 * few seconds; long-lived ones (signed URLs) are left alone.
 */
export function useRefreshOnNavigation() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    // The first screen just loaded its data.
    if (first.current) {
      first.current = false;
      return;
    }
    const now = Date.now();
    void queryClient.refetchQueries({
      type: 'active',
      predicate: (query) => !isLongLived(query) && now - query.state.dataUpdatedAt > REFRESH_MIN_AGE_MS,
    });
  }, [pathname]);
}
