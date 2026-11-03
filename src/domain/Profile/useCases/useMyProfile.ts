import { useQuery } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { profileService } from '../profileService';

export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.MyProfile, userId],
    queryFn: () => profileService.getById(userId!),
    enabled: !!userId,
  });
}
