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

/** Leaves a gym (never the owner: transfer first). */
export function useLeaveGym() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) => membershipService.remove(membershipId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyMemberships] }),
  });
}

export function useTransferOwnership(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) => membershipService.transferOwnership(gymId, membershipId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [QueryKeys.MyMemberships] }),
        queryClient.invalidateQueries({ queryKey: [QueryKeys.GymMembers, gymId] }),
        // The old owner no longer sees professor requests nor the codes.
        queryClient.invalidateQueries({ queryKey: [QueryKeys.PendingRequests, gymId] }),
        queryClient.removeQueries({ queryKey: [QueryKeys.ProfessorCodes, gymId] }),
        queryClient.removeQueries({ queryKey: [QueryKeys.StudentCode, gymId] }),
      ]),
  });
}
