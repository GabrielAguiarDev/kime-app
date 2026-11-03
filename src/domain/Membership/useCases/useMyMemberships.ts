import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { membershipService } from '../membershipService';

export function useMyMemberships(userId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.MyMemberships, userId],
    queryFn: () => membershipService.listMine(userId!),
    enabled: !!userId,
  });
}
