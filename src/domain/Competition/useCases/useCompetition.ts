import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { LocalDate } from '@domain/Classes';
import { QueryKeys } from '@infra/query';

import { competitionService as service } from '../competitionService';
import type { ChampionshipInput, WeekTargets } from '../competitionTypes';

// ------------------------------------------------------------- team ---
function useInvalidateMemberships() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [QueryKeys.MyMemberships] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GymMembers] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.ChampionshipEntries] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.MyChampionships] }),
    ]);
}

/** Staff: invite a student to the competition team. */
export function useInviteCompetitor() {
  const onSuccess = useInvalidateMemberships();
  return useMutation({ mutationFn: (membershipId: string) => service.inviteCompetitor(membershipId), onSuccess });
}

/** Student: accept or decline their invite. */
export function useRespondCompetitorInvite() {
  const onSuccess = useInvalidateMemberships();
  return useMutation({
    mutationFn: ({ membershipId, accept }: { membershipId: string; accept: boolean }) =>
      service.respondInvite(membershipId, accept),
    onSuccess,
  });
}

/** Staff take a student off the team (or cancel the invite); the student can leave. */
export function useRemoveCompetitor() {
  const onSuccess = useInvalidateMemberships();
  return useMutation({ mutationFn: (membershipId: string) => service.removeCompetitor(membershipId), onSuccess });
}

// ---------------------------------------------------- championships ---
export function useChampionships(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.Championships, academyId],
    queryFn: () => service.listChampionships(academyId!),
    enabled: !!academyId,
  });
}

/** Competitor: championships they are entered in (every academy). */
export function useMyChampionships(athleteId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [QueryKeys.MyChampionships, athleteId],
    queryFn: () => service.listMyChampionships(athleteId!),
    enabled: !!athleteId && enabled,
  });
}

export function useChampionshipEntries(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.ChampionshipEntries, academyId],
    queryFn: () => service.listEntries(academyId!),
    enabled: !!academyId,
  });
}

export function useChampionshipMutations(academyId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Championships, academyId] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.ChampionshipEntries, academyId] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.MyChampionships] }),
    ]);
  return {
    create: useMutation({
      mutationFn: (input: ChampionshipInput) => service.createChampionship(academyId, input),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: ChampionshipInput }) => service.updateChampionship(id, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => service.deleteChampionship(id), onSuccess }),
    setEntries: useMutation({
      mutationFn: ({ championshipId, athleteIds }: { championshipId: string; athleteIds: string[] }) =>
        service.setEntries(championshipId, athleteIds),
      onSuccess,
    }),
  };
}

// ------------------------------------------------------------ weight ---
export function useWeightLogs(athleteId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.WeightLogs, athleteId],
    queryFn: () => service.listWeights(athleteId!),
    enabled: !!athleteId,
  });
}

export function useWeightMutations(athleteId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [QueryKeys.WeightLogs, athleteId] }),
      // The latest weigh-in becomes the profile weight (automatic water goal).
      queryClient.invalidateQueries({ queryKey: [QueryKeys.MyProfile] }),
    ]);
  return {
    save: useMutation({
      mutationFn: ({ loggedOn, weightKg, existingId }: { loggedOn: LocalDate; weightKg: number; existingId?: string }) =>
        service.saveWeight(athleteId, loggedOn, weightKg, existingId),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => service.deleteWeight(id), onSuccess }),
  };
}

// -------------------------------------------------------- water plan ---
export function useWaterPlans(athleteId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [QueryKeys.WaterPlans, athleteId],
    queryFn: () => service.listWaterPlans(athleteId!),
    enabled: !!athleteId && enabled,
  });
}

/** Staff: a competitor's water logs of the last days (newest server copy; logs still on their phone are missing). */
export function useAthleteWater(athleteId: string | undefined, days: number) {
  return useQuery({
    queryKey: [QueryKeys.AthleteWater, athleteId, days],
    queryFn: () => service.listAthleteWater(athleteId!, new Date(Date.now() - days * 86_400_000).toISOString()),
    enabled: !!athleteId,
  });
}

export function useSetWaterPlan(academyId: string, athleteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targets: WeekTargets) => service.setWaterPlan(academyId, athleteId, targets),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.WaterPlans, athleteId] }),
  });
}
