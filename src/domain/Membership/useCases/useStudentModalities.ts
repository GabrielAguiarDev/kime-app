import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { membershipService } from '../membershipService';

/** Staff approve a student request with the chosen modalities (at least one). */
export function useApproveStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, modalityIds }: { membershipId: string; modalityIds: string[] }) =>
      membershipService.approveStudent(membershipId, modalityIds),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [QueryKeys.PendingRequests] }),
        queryClient.invalidateQueries({ queryKey: [QueryKeys.GymMembers] }),
      ]),
  });
}

/** Staff replace the modalities of an active student (at least one; removing keeps the history). */
export function useSetStudentModalities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, modalityIds }: { membershipId: string; modalityIds: string[] }) =>
      membershipService.setStudentModalities(membershipId, modalityIds),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [QueryKeys.GymMembers] }),
        queryClient.invalidateQueries({ queryKey: [QueryKeys.Ranking] }),
        queryClient.invalidateQueries({ queryKey: [QueryKeys.RankingModalities] }),
        queryClient.invalidateQueries({ queryKey: [QueryKeys.ChampionshipEntries] }),
      ]),
  });
}
