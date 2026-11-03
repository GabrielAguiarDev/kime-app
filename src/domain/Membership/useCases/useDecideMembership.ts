import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { membershipService } from '../membershipService';

export function useDecideMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, approve }: { membershipId: string; approve: boolean }) =>
      membershipService.decide(membershipId, approve),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.PendingRequests] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GymMembers] });
    },
  });
}

export function useRemoveMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) => membershipService.remove(membershipId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.GymMembers] }),
  });
}
