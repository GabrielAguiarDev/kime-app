import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { membershipService } from '../membershipService';

export function usePendingRequests(gymId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.PendingRequests, gymId],
    queryFn: () => membershipService.listPending(gymId!),
    enabled: !!gymId,
  });
}
