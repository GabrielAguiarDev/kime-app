import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { gymService } from '../gymService';
import type { InviteRole } from '../gymTypes';

export function useGymInvites(gymId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.GymInvites, gymId],
    queryFn: () => gymService.listActiveInvites(gymId!),
    enabled: !!gymId,
  });
}

export function useRotateInvite(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (role: InviteRole) => gymService.rotateInvite(gymId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.GymInvites, gymId] }),
  });
}

export function useGymInviteCode(gymId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.GymInviteCode, gymId],
    queryFn: () => gymService.getInviteCode(gymId!),
    enabled: !!gymId,
  });
}
