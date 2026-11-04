import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Belt } from '@components';
import { QueryKeys } from '@infra/query';

import { classesService as service } from '../classesService';
import type { LocalDate, ScheduleInput } from '../classesTypes';
import type { ScheduleGroupPlan } from '../scheduleGroups';

// ---------------------------------------------------------------- today ---
/** Academy-local date from the server (never the device clock). */
export function useAcademyToday(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.AcademyToday, academyId],
    queryFn: () => service.academyToday(academyId!),
    enabled: !!academyId,
    staleTime: 60_000,
  });
}

// ------------------------------------------------------------ schedules ---
export function useSchedules(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.ClassSchedules, academyId],
    queryFn: () => service.listSchedules(academyId!),
    enabled: !!academyId,
  });
}

export function useScheduleMutations(academyId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: [QueryKeys.ClassSchedules, academyId] });
  return {
    create: useMutation({ mutationFn: (input: ScheduleInput) => service.createSchedule(academyId, input), onSuccess }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: ScheduleInput }) => service.updateSchedule(id, input),
      onSuccess,
    }),
    setActive: useMutation({
      mutationFn: ({ id, active }: { id: string; active: boolean }) => service.setScheduleActive(id, active),
      onSuccess,
    }),
    /** One time + modality on several weekdays (see planScheduleGroup). */
    saveGroup: useMutation({
      mutationFn: ({ plan, startTime, modality }: { plan: ScheduleGroupPlan; startTime: string; modality: string }) =>
        service.saveScheduleGroup(academyId, plan, startTime, modality),
      onSuccess,
    }),
    setGroupActive: useMutation({
      mutationFn: ({ ids, active }: { ids: string[]; active: boolean }) => service.setSchedulesActive(ids, active),
      onSuccess,
    }),
    removeGroup: useMutation({ mutationFn: (ids: string[]) => service.deleteSchedules(ids), onSuccess }),
  };
}

// ----------------------------------------------------------- modalities ---
export function useModalities(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.Modalities, academyId],
    queryFn: () => service.listModalities(academyId!),
    enabled: !!academyId,
  });
}

/** Settings screen: rename / remove (existing schedules keep their text). */
export function useModalityMutations(academyId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: [QueryKeys.Modalities, academyId] });
  return {
    rename: useMutation({
      mutationFn: ({ id, name }: { id: string; name: string }) => service.renameModality(id, name),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => service.deleteModality(id), onSuccess }),
  };
}

export function useCreateModality(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, position }: { name: string; position: number }) =>
      service.createModality(academyId, name, position),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.Modalities, academyId] }),
  });
}

// ----------------------------------------------------------- belt goals ---
export function useBeltGoals(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.BeltGoals, academyId],
    queryFn: () => service.listBeltGoals(academyId!),
    enabled: !!academyId,
  });
}

export function useBeltGoalMutations(academyId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: [QueryKeys.BeltGoals, academyId] });
  return {
    create: useMutation({
      mutationFn: ({ belt, position, classesRequired }: { belt: Belt; position: number; classesRequired: number }) =>
        service.createBeltGoal(academyId, belt, position, classesRequired),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, classesRequired }: { id: string; classesRequired: number }) =>
        service.updateBeltGoal(id, classesRequired),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => service.deleteBeltGoal(id), onSuccess }),
    reorder: useMutation({
      mutationFn: (orderedIds: string[]) => service.reorderBeltGoals(academyId, orderedIds),
      onSuccess,
    }),
  };
}

// --------------------------------------------------- student check-ins ---
export function useMyCheckins(academyId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.MyCheckins, academyId, userId],
    queryFn: () => service.listMyCheckins(academyId!, userId!),
    enabled: !!academyId && !!userId,
  });
}

export function useCheckIn(academyId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scheduleId, date }: { scheduleId: string; date: LocalDate }) =>
      service.createCheckin(academyId, userId, scheduleId, date),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyCheckins, academyId, userId] }),
  });
}

export function useCancelCheckin(academyId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (checkinId: string) => service.cancelCheckin(checkinId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QueryKeys.MyCheckins, academyId, userId] }),
  });
}

// ------------------------------------------------- professor check-ins ---
export function useAcademyCheckins(academyId: string | undefined, date: LocalDate | undefined) {
  return useQuery({
    queryKey: [QueryKeys.AcademyCheckins, academyId, date],
    queryFn: () => service.listCheckinsOn(academyId!, date!),
    enabled: !!academyId && !!date,
  });
}

function useInvalidateDecisions(academyId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [QueryKeys.AcademyCheckins, academyId] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.MemberStats, academyId] }),
    ]);
}

export function useDecideCheckin(academyId: string) {
  const onSuccess = useInvalidateDecisions(academyId);
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'confirmed' | 'rejected' }) => service.decideCheckin(id, status),
    onSuccess,
  });
}

export function useConfirmAll(academyId: string) {
  const onSuccess = useInvalidateDecisions(academyId);
  return useMutation({
    mutationFn: ({ scheduleId, date }: { scheduleId: string; date: LocalDate }) => service.confirmAll(scheduleId, date),
    onSuccess,
  });
}

// ----------------------------------------------------- stats and belts ---
/** Professor: every member of the academy. Student: only their own row (RLS). */
export function useMemberStats(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.MemberStats, academyId],
    queryFn: () => service.listMemberStats(academyId!),
    enabled: !!academyId,
  });
}

export function useBeltHistory(membershipId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.BeltHistory, membershipId],
    queryFn: () => service.listBeltHistory(membershipId!),
    enabled: !!membershipId,
  });
}

export function useAwardBelt(academyId: string, membershipId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (belt: Belt) => service.awardBelt(membershipId, belt),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [QueryKeys.MemberStats, academyId] }),
        queryClient.invalidateQueries({ queryKey: [QueryKeys.BeltHistory, membershipId] }),
        queryClient.invalidateQueries({ queryKey: [QueryKeys.GymMembers, academyId] }),
      ]),
  });
}
