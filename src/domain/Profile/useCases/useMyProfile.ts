import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { profileService } from '../profileService';
import type { BodyAndBottle } from '../profileTypes';

export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.MyProfile, userId],
    queryFn: () => profileService.getById(userId!),
    enabled: !!userId,
  });
}

/** Perfil → Água: weight, height and bottle. */
export function useUpdateBodyAndBottle(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BodyAndBottle) => profileService.updateBodyAndBottle(userId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyProfile, userId] }),
  });
}
