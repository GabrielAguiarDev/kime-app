import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { gymService } from '../gymService';

/**
 * Plans of the academy sign-up. The catalog rarely changes: a long staleTime
 * keeps it out of the 15 s polling and the refresh on navigation
 * (infra/query isLongLived).
 */
export function usePublicPlans() {
  return useQuery({
    queryKey: [QueryKeys.PublicPlans],
    queryFn: gymService.listPublicPlans,
    staleTime: 10 * 60_000,
  });
}
