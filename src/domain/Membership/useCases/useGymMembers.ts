import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { membershipService } from '../membershipService';

export function useGymMembers(gymId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.GymMembers, gymId],
    queryFn: () => membershipService.listByGym(gymId!),
    enabled: !!gymId,
  });
}
