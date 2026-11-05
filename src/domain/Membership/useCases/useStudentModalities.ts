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

/** Staff set a student's weekly class goal in a modality (null = the modality's goal). */
export function useSetStudentWeeklyGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, modalityId, goal }: { membershipId: string; modalityId: string; goal: number | null }) =>
      membershipService.setStudentWeeklyGoal(membershipId, modalityId, goal),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [QueryKeys.GymMembers] }),
        queryClient.invalidateQueries({ queryKey: [QueryKeys.Ranking] }),
      ]),
  });
}
